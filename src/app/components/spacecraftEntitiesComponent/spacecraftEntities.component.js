(function() {

angular
.module("beryllium-mms")
.component("spacecraftEntities", {
    template: "",
    require: {
        cesium: "^^cesium"
    },
    bindings: {
        timeframe: "<",
        selectedSpacecraft: "<",
        selectedParam1d: "<",
        selectedParam3d: "<"
    },
    controller: [
        "inSituProvider",
        "berylliumColors",
        spacecraftController
    ]
});

var ORBIT_PATH_RESOLUTION_SECONDS = 60;

// The longest whisker we show will be this long.
// All other whiskers will have a length somewhere
// between this value and 0.
var WHISKER_MAX_LENGTH = 10000000; // unit = meters

function spacecraftController( inSituProvider, berylliumColors ) {
    var vm = this;
    vm.dataProvider = inSituProvider;

    vm.$onChanges = function( changesObj ) {

        // If timeframe, selectedSpacecraft, selectedParam1d or
        // selectedParam3d changes,
        // that means we'll have to load new data. The only exception
        // is if we don't have valid timeframe values yet - in that
        // case we'll have to wait and make the request later when
        // they become available.
        var reloadNecessary =
            changesObj.timeframe ||
            changesObj.selectedSpacecraft ||
            changesObj.selectedParam1d ||
            changesObj.selectedParam3d;

        var timeframeAvailable = vm.timeframe.start && vm.timeframe.end;

        if( reloadNecessary && timeframeAvailable )
        {
            deleteEntities();
            vm.dataProvider.requestReload();
        }
    };

    // vm.cesium won't be available until $onInit
    vm.$onInit = function() {
        // Register to be notified when the viewer is ready
        vm.cesium.onViewerReady( onViewerReady );

        // When the reference frame changes, request new data. The raw data itself
        // won't change (i.e. we don't need to make another server request), but
        // the DataProvider will have to re-generate the Properties from the
        // raw data, and we'll have to re-create our Entities from the Properites.
        // Currently, we rely on the fact that the DataProvider uses the
        // requestCacherService to avoid duplicate requests. If anything fails
        // with that request caching (e.g. browser doesn't support sessionStorage
        // or sessionStorage is already full) then duplicate requests will be
        // made
        vm.cesium.onReferenceFrameChange(function() {
            deleteEntities();
            vm.dataProvider.requestReload();
        });
    };

    // The DataProvider needs to know a few things in order to be able to
    // request the appropriate data. Since this component knows many of
    // those things, we'll register to be a requirementsProvider whenver
    // a new request is being made.
    vm.dataProvider.requirementsManager.addRequirementsProvider(function() {
        return {
            isInertial: vm.cesium.referenceFrame === "inertial",
            timeframe: vm.timeframe,
            spacecraft: vm.selectedSpacecraft,
            param1d: vm.selectedParam1d,
            param3d: vm.selectedParam3d,
            ephemerisSelection: [ "time", "x", "y", "z" ]
        }
    });

    // Closure-scoped variables containing the Entities we create
    var orbitEntity, orbitPathPrimitive, orbitWhiskersPrimitiveCollection;

    // When we get new Properties from the DataProvider, re-create our Entities
    var tmpProperties = null;
    vm.dataProvider.dataReady.addEventListener(function( properties ) {
        if( !vm.cesium.viewer ) {
            // Only set up the onViewerReady handler once
            if( tmpProperties === null ) {
                vm.cesium.onViewerReady(function() {
                    renderNewData(tmpProperties);
                    tmpProperties = null; // no longer needed, allow to be GC'ed
                });
            }
            // If this is called multiple times, only save off
            // the most recent data
            tmpProperties = properties;
        }
        else {
            renderNewData( properties );
        }
    });

    function renderNewData( properties ) {
        deleteEntities();
        var viewer = vm.cesium.viewer;

        // Update the Cesium Clock (and, indirectly, the start/end dates in the sidebar)
        // once we know what dates were actually returned from the server.
        vm.cesium.setCesiumDates({
            start: properties.dataStartDate,
            end: properties.dataEndDate
        });

        var orbitPathColor = berylliumColors.MISSING_VALUE_COLOR.withAlpha(0.5);

        var cesiumReferenceFrame = vm.cesium.referenceFrame === "inertial"
            ? Cesium.ReferenceFrame.INERTIAL
            : Cesium.ReferenceFrame.FIXED;

        var orbitEntityConfig = {
            id: "orbitEntity",
            availability: vm.cesium.defaultAvailability(),
            position: properties.orbitPosition,
            orientation: properties.spacecraftOrientation,
            model: {
                uri: "models/mms.glb",
                minimumPixelSize: 50.0
            }
        };

        // For 1D parameters, we want to display a different color at every point
        // on the line (potentially). Unfortunately the Entity API doesn't allow
        // for this, so we have to use Polylines from the Primitives API to get
        // those colors. The Entity API seems to be more efficient, so we'll leave
        // it in if we don't have a param1d to display (i.e. configure
        // orbitEntityConfig.path), but replace it with a separate orbitPathPrimitive
        // object when necessary.
        if( !properties.param1d ) {
            orbitEntityConfig.path = {
                material: orbitPathColor,
                width: 3,
                resolution: ORBIT_PATH_RESOLUTION_SECONDS
            };
        }
        else {
            var julianDates = julianDateRangeArray(
                properties.dataStartDate,
                properties.dataEndDate,
                ORBIT_PATH_RESOLUTION_SECONDS
            );

            orbitPathPrimitive = viewer.scene.primitives.add(
                new Cesium.Primitive({
                    geometryInstances: new Cesium.GeometryInstance({
                        geometry: new Cesium.PolylineGeometry({
                            positions: getPropertyValuesInReferenceFrame(
                                properties.orbitPosition,
                                julianDates,
                                cesiumReferenceFrame
                            ),
                            width: 5,
                            vertexFormat: Cesium.PolylineColorAppearance.VERTEX_FORMAT,
                            colors: berylliumColors.interpolateArray(
                                getPropertyValues( properties.param1d, julianDates ),
                                properties.orbitPathColormap
                            ),
                            followSurface: false
                        })
                    }),
                    appearance: new Cesium.PolylineColorAppearance()
                })
            );
        }

        if( properties.param3d ) {

            var minMag = Number.MAX_VALUE;
            var maxMag = -Number.MAX_VALUE;
            var maxIndex = -1;
            var magnitudes = properties.param3d.map(function( row, index ) {
                var vector = row[1];
                var mag = Cesium.Cartesian3.magnitude( vector );

                if( mag < minMag ) { minMag = mag; }
                if( mag > maxMag ) { maxMag = mag; maxIndex = index; }

                return mag;
            });
            var vectorColors = berylliumColors.interpolateArray( magnitudes, properties.whiskerColormap );

            var interpolateWhiskerLength = function( magnitude, whiskerVector, result ) {
                if( magnitude === 0 ) {
                    return Cesium.Cartesian3.clone( whiskerVector, result );
                }
                else {
                    // interpolate to range 0-1
                    var interpolatedMagnitude =
                        (magnitude - minMag) /
                        (maxMag - minMag);

                    // scale to range 0-WHISKER_MAX_LENGTH
                    interpolatedMagnitude *= WHISKER_MAX_LENGTH;

                    return Cesium.Cartesian3.multiplyByScalar( whiskerVector, interpolatedMagnitude/magnitude, result );
                }
            };

            orbitWhiskersPrimitiveCollection = new Cesium.PrimitiveCollection();

            // scratch matrices
            var toInertial = new Cesium.Matrix3();
            var fromInertial = new Cesium.Matrix3();

            var seenPositions = new Set();

            properties.param3d.forEach(function( row, index ) {
                var julianDate = row[0];
                var vector = row[1];

                var magnitude = magnitudes[index];
                var color = vectorColors[index];

                var orbitPos = properties.orbitPosition.getValue( julianDate );
                if( !orbitPos ) {
                    return; // can't do anything without this!
                }
                if(seenPositions.has(orbitPos)) {
                    console.error("Duplicated position:", orbitPos);
                    return;
                }
                seenPositions.add(orbitPos);

                if( vm.cesium.referenceFrame === "inertial" ) {
                    if (!Cesium.defined(Cesium.Transforms.computeIcrfToFixedMatrix(julianDate, toInertial))) {
                        console.error("Failed to get inertial transform");
                        return; // can't compute anything meaningful without this
                    }
                    Cesium.Matrix3.transpose(toInertial,fromInertial);
                    Cesium.Matrix3.multiplyByVector(fromInertial, orbitPos, orbitPos);
                }

                var endPoint = new Cesium.Cartesian3();
                interpolateWhiskerLength( magnitude, vector, endPoint );
                Cesium.Cartesian3.add( orbitPos, endPoint, endPoint );

                orbitWhiskersPrimitiveCollection.add( new Cesium.Primitive({
                    geometryInstances: new Cesium.GeometryInstance({
                        geometry: new Cesium.PolylineGeometry({
                            positions: [ orbitPos, endPoint ],
                            colors: [ color, color ],
                            width: 1,
                            followSurface: false
                        })
                    }),
                    appearance: new Cesium.PolylineColorAppearance()
                }));

            });

            viewer.scene.primitives.add(
                orbitWhiskersPrimitiveCollection
            );
        }

        // Entity representing the spacecraft itself
        orbitEntity = viewer.entities.add( orbitEntityConfig );
    }

    // Utility function to clean up all of our entities/primitives at once.
    // This will have to be updated if we ever add more entities/primitives.
    function deleteEntities() {
        vm.cesium.deleteEntity([ orbitEntity, orbitPathPrimitive, orbitWhiskersPrimitiveCollection ]);
        orbitEntity = orbitPathPrimitive = orbitWhiskersPrimitiveCollection = undefined;
    }

    // Create an array of JulianDate objects
    function julianDateRangeArray( startDate, endDate, stepSeconds ) {
        var result = [];
        var time = startDate.getTime();
        var endTime = endDate.getTime();

        while( time <= endTime ) {
            result.push(
                Cesium.JulianDate.fromDate(
                    new Date( time )
                )
            );

            time += stepSeconds * 1000; // convert to milliseconds
        }

        return result;
    }

    // Evaluate property.getValue( date ) for each date in julianDates
    // and return the result as an array.
    function getPropertyValues( property, julianDates ) {
        return julianDates.map(function( julianDate ) {
            return property.getValue( julianDate );
        });
    }

    // Evaluate property.getValueInReferenceFrame( date ) for each date in julianDates
    // and return the result as an array.
    function getPropertyValuesInReferenceFrame( property, julianDates, referenceFrame ) {
        return julianDates.map(function( julianDate ) {
            return property.getValueInReferenceFrame( julianDate, referenceFrame );
        });
    }

    // Scratch matrices for onTick
    var toInertial = new Cesium.Matrix3();
    var scratchModelMatrix = new Cesium.Matrix4();

    function onTick( clock ) {
        if( vm.cesium.referenceFrame === "inertial" ) {
            if(!Cesium.defined(Cesium.Transforms.computeIcrfToFixedMatrix(clock.currentTime, toInertial))) {
                Cesium.Matrix3.IDENTITY.clone(toInertial);
            }

            // Generate a matrix that represents the current geo-to-inertial rotation
            scratchModelMatrix = Cesium.Matrix4.fromRotationTranslation(
                toInertial,
                Cesium.Cartesian3.ZERO,
                scratchModelMatrix
            );

            // Apply rotation to orbitPathPrimitive
            if( orbitPathPrimitive ) {
                scratchModelMatrix.clone( orbitPathPrimitive.modelMatrix );
            }

            if( orbitWhiskersPrimitiveCollection ) {
                var len = orbitWhiskersPrimitiveCollection.length;
                for( var i=0; i<len; i++ ) {
                    var whiskerPrimitive = orbitWhiskersPrimitiveCollection.get(i);
                    scratchModelMatrix.clone( whiskerPrimitive.modelMatrix );
                }
            }
        }
    }

    // Event handler for onViewerReady event from the cesium controller.
    function onViewerReady( viewer ) {
        viewer.clock.onTick.addEventListener( onTick );
    }
}

})();
