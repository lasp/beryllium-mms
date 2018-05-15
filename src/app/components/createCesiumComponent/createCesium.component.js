(function() {

/**
 * <create-cesium> component
 *
 * This component must live inside the <cesium>
 * component. It calls cesium.makeViewer(...)
 * once all the necessary data has loaded. This
 * component does not add any entities to the
 * Cesium viewer.
 */
angular
.module("beryllium-mms")
.component("createCesium", {
    template: "",
    require: {
        cesium: "^^cesium"
    },
    bindings: {
        initialDates: '<'
    },
    controller: [
        '$timeout',
        'icrfPreloader',
        'mms3dConstants',
        createCesiumController
    ]
});

// Note: the 'require'-ed controllers will not be available
// in the constructor, you'll have to wait until $onInit
function createCesiumController( $timeout, icrfPreloader, constants ) {
    var vm = this;

    // Test whether initialDates has a value at the time that this
    // component is created. If not, this value will be set to
    // true later, once they have been received.
    var initialDatesReceived =
        vm.initialDates &&
        vm.initialDates.start &&
        vm.initialDates.end;

    // If we have initialDates, use them to initialize the
    // Cesium viewer.
    vm.$onInit = function() {
        if( initialDatesReceived ) {
            $timeout(function() {
                initCesium( vm.initialDates );
            }, 0, false);
        }
    };

    vm.$onChanges = function( changesObj ) {

        // If we didn't receive initialDates at creation time,
        // and this is the first time we've received them, then
        // initialize the Cesium viewer and set
        // initialDatesReceived to true.
        if(
            !initialDatesReceived &&
            changesObj.initialDates &&
            changesObj.initialDates.currentValue &&
            changesObj.initialDates.currentValue.start &&
            changesObj.initialDates.currentValue.end
        )
        {
            // Make sure to preload ICRF data for this time range. This is needed
            // so that we can compute the sub-solar point.
            icrfPreloader.preloadIcrf( vm.initialDates.start, vm.initialDates.end ).then(function() {
                initCesium( changesObj.initialDates.currentValue );
            });
            initialDatesReceived = true;
        }
    };

    // Initialize the Cesium viewer and configure it as appropriate
    var initCesiumHasBeenCalled = false;
    function initCesium( timeframe ) {
        if( initCesiumHasBeenCalled ) { return; }
        initCesiumHasBeenCalled = true;

        var viewer = vm.cesium.makeViewer(
            timeframe.start,
            timeframe.end,
            function( config ) {
                return angular.extend(
                    {},
                    config,
                    {
                        geocoder: false,
                        homeButton: false,
                        sceneModePicker: false,
                        infoBox: false,
                        navigationHelpButton: false
                    }
                );
            }
        );

        // Render shadows on the night side
        viewer.scene.globe.enableLighting = true;

        var sunPositionLatLng = getSubsolarPoint(timeframe.start);

        // empirically a good height - usually fits most/all of the orbit
        // inside the viewport
        var cameraHeight = constants.EARTH_RADIUS_METERS * 30;

        // Make sure the frustum is large enough to accommodate
        // the MMS orbit when zooming out.
        // 1e15 is just an arbitrary value that happens to
        // be sufficiently large.
        viewer.camera.frustum.far = 1e15;

        // Viewer clock settings
        viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
        viewer.clock.multiplier = 1000;

        // Fly the camera to a default starting location. For MMS, the apogee
        // is typically "pointed" at the Sun, so we compute the subsolar
        // lat/lng and fly to a point based on that.
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
                Cesium.Math.toDegrees(sunPositionLatLng.longitude),
                0, // puts the camera at the equator - looks a little better IMO
                cameraHeight
            )
        });

        //This fixes a bug where, upon the double-click of a page element, the
        //camera zooms to inside the planet. This same bug would occur using an
        //infobox that came up on a single click, and that infobox was removed
        //in the initialization of the Cesium viewer above.
        viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    // Use Cesium data to get the subsolar point. Requires ICRF data to be
    // preloaded (see https://cesiumjs.org/Cesium/Build/Documentation/Transforms.html#.preloadIcrfFixed)
    function getSubsolarPoint(date) {
        var julianDate = Cesium.JulianDate.fromDate(date);

        var sunPosition = Cesium.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(
            Cesium.JulianDate.fromDate(date)
        );

        var icrfToFixed = Cesium.Transforms.computeIcrfToFixedMatrix(julianDate);

        Cesium.Matrix3.multiplyByVector(icrfToFixed, sunPosition, sunPosition);

        var sunPositionLatLng = Cesium.Cartographic.fromCartesian(sunPosition);
        sunPositionLatLng.height = 0; // right on surface

        return sunPositionLatLng;
    }


}

})();
