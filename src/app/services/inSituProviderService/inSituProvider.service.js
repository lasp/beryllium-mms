(function() {

angular.module('beryllium-mms')
.service( 'inSituProvider', [
    'AbstractDataProvider',
    'RequirementsManager',
    'icrfPreloader',
    '$q',
    'latisMms3d',
    "berylliumColors",
    function( AbstractDataProvider, RequirementsManager, icrfPreloader, $q, latisMms3d, berylliumColors ) {

        var KpDataProvider = AbstractDataProvider.createSubclass(function() {
            AbstractDataProvider.apply( this );

            this.requirementsManager = new RequirementsManager();
        });

        KpDataProvider.prototype.makeRequest = function( ) {

            var requirements = this.requirementsManager.gatherRequirements();
            var timeframe = requirements.findFirst( "timeframe" );
            var isInertial = requirements.findFirst( "isInertial" );
            var ephemerisSelection = requirements.concatAll( "ephemerisSelection" );
            var spacecraft = requirements.findFirst( "spacecraft" );
            var param1d = requirements.findFirst( "param1d" );
            var param3d = requirements.findFirst( "param3d" );

            var startTime = timeframe.start;
            var endTime = timeframe.end;

            // Make sure to preload ICRF data for this time range. Don't let
            // the returned promise resolve until this has been completed.
            var icrfRequest = icrfPreloader.preloadIcrf( startTime, endTime );

            // Note: at the moment filtering on sc_id=mms1 is a speed optimization because
            // latis will return the same data either way, but without the filter it will
            // read through 4x the files to get the same data (long story). In the future,
            // latis will require sc_id to be passed as a param because it doesn't make
            // (much) sense to mix all 4 of the sc's ephemeris data together like that.
            var scidFilter = [ 'sc_id=' + spacecraft ];
            var timeFilters = [
                'time>=' + startTime.toISOString(),
                'time<=' + endTime.toISOString()
            ];

            var ephemerisFilters = [].concat(scidFilter).concat(timeFilters);
            var ephemerisRequest = latisMms3d.get(
                'mms_ephemeris',
                'jsond',
                ephemerisSelection,
                ephemerisFilters
            );

            var param1dRequest = null;
            if( param1d && param1d != "none" ) {
                var dataset1d = spacecraft + "_" + param1d;
                var selection1d = null; // all parameters
                var filters1d = ["exclude_missing()"].concat(timeFilters);
                param1dRequest = latisMms3d.get( dataset1d, 'jsond', selection1d, filters1d );
            }

            var param3dRequest = null;
            if( param3d && param3d != "none" ) {
                var dataset3d = spacecraft + "_" + param3d;
                var selection3d = null; // all parameters
                var filters3d = [].concat(timeFilters);
                param3dRequest = latisMms3d.get( dataset3d, 'jsond', selection3d, filters3d );
            }

            // Listeners won't really need to see the ICRF data, but
            // we shouldn't call ourselves 'done' until that's finished
            // loading too.
            var combinedPromise = $q.all({
                ephemeris: ephemerisRequest,
                icrf: icrfRequest,
                param1d: param1dRequest,
                param3d: param3dRequest
            }).then(function( results ) {

                var result = transformEphemerisData( results.ephemeris ); // only show listeners the data from ephemerisRequest

                if( results.param1d ) {
                    result.param1d = transformParam1d( results.param1d );
                    result.orbitPathColormap = berylliumColors.DEFAULT;

                    var minmax = findMinMax( result.param1d._values );
                    result.minOrbitColorParam = minmax.min;
                    result.maxOrbitColorParam = minmax.max;
                }

                if( results.param3d ) {
                    result.param3d = transformParam3d( results.param3d );
                    result.whiskerColormap = berylliumColors.DEFAULT;

                    var param3dMagnitudes = [];

                    // Populates the param3dMagnitudes array with the 3d parameter magnitudes
                    // Note that these are the true magnitudes, not the log10 magnitudes
                    var param3dMagnitudes = results.param3d.data.map(function(row) {
                        var xyz = new Cesium.Cartesian3(row[1], row[2], row[3]);
                        return Cesium.Cartesian3.magnitude(xyz);
                    });

                    var minmax = findMinMax( param3dMagnitudes );
                    result.minWhiskerMagnitude = minmax.min;
                    result.maxWhiskerMagnitude = minmax.max;
                }

                return result;
            });

            // If the ephemerisRequest is abortable, make this promise abortable as well.
            // The ephemerisRequest may not be abortable if the requested data is already
            // cached, for example.
            if( ephemerisRequest.abort ) {
                combinedPromise.abort = function() {
                    ephemerisRequest.abort();
                }
            }

            return combinedPromise;

            function transformEphemerisData( response ) {

                var TIME = response.parameters.indexOf("time");
                var X = response.parameters.indexOf("x");
                var Y = response.parameters.indexOf("y");
                var Z = response.parameters.indexOf("z");

                var startTime = new Date( response.data[0][TIME] );
                var endTime = new Date( response.data[response.data.length-1][TIME] );

                // scratch matrices
                var toInertial = new Cesium.Matrix3();
                var fromInertial = new Cesium.Matrix3();

                var orbitPosition = isInertial
                    ? new Cesium.SampledPositionProperty(Cesium.ReferenceFrame.INERTIAL)
                    : new Cesium.SampledPositionProperty();

                for( var i=0; i<response.data.length; i++ ) {

                    var row = response.data[i];

                    // Note: convert km to m
                    var orbitPos = new Cesium.Cartesian3(
                        row[X] * 1000,
                        row[Y] * 1000,
                        row[Z] * 1000
                    );

                    var julianDate = Cesium.JulianDate.fromDate(
                        new Date( row[TIME] )
                    );

                    if( !isInertial ) {
                        if( Cesium.defined(
                            Cesium.Transforms.computeFixedToIcrfMatrix( julianDate, toInertial )
                        ))
                        {
                            // Note: since this is a rotation-only matrix,
                            // the transpose is a faster way to compute
                            // the inverse, which is what we really want.
                            fromInertial = Cesium.Matrix3.transpose( toInertial, fromInertial );
                            Cesium.Matrix3.multiplyByVector(fromInertial, orbitPos, orbitPos);
                        }
                    }

                    orbitPosition.addSample( julianDate, orbitPos );
                }

                return {
                    orbitPosition: orbitPosition,
                    dataStartDate: startTime,
                    dataEndDate: endTime
                };
            }

            function transformParam1d( response ) {

                var param1d = new Cesium.SampledProperty(Number);

                for( var i=0; i<response.data.length; i++) {
                    var row = response.data[i];

                    // NOTE: this assumes that each row is [time, data]
                    // This may cease to be true in the future as we
                    // add more datasets, but it should work for now.
                    var time = row[0];
                    var datum = row[1];

                    var julianDate = Cesium.JulianDate.fromDate(
                        new Date( time )
                    );
                    param1d.addSample( julianDate, datum );
                }

                return param1d;
            }

            function transformParam3d( response ) {

                var result = [];

                for( var i=0; i<response.data.length; i++ ) {
                    var row = response.data[i];

                    // Note: I don't know if we can always assume that the
                    // parameters will be ordered like this, but for now
                    // it's working.
                    var time = row[0];
                    var x = row[1];
                    var y = row[2];
                    var z = row[3];

                    var xyz = new Cesium.Cartesian3(
                        x, y, z
                    );

                    // This scales the magnitude of the whisker to be proportional to
                    // log10(trueMag+1). The log10 allows us to better visualize small
                    // whiskers, which is where the interesting data is, anyway. The
                    // +1 allows us to avoid the negative range of the log function
                    // (as x shrinks from 1 to 0, log(x) approaches negative infinity)
                    // which would cause the direction of the vectors to flip. It
                    // essentially just shifts the log function to the left without
                    // modifying it in any other way.
                    var mag = Cesium.Cartesian3.magnitude(xyz);
                    Cesium.Cartesian3.multiplyByScalar(xyz, Math.log10(mag+1)/mag, xyz);

                    result.push([
                        Cesium.JulianDate.fromDate( new Date(time) ),
                        xyz
                    ]);
                }

                return result;
            }
        };

        return new KpDataProvider();
    }
]);

// Find the min and max values of the passed array in
// a single pass. Return an object of the form
// { min: Number, max: Number }
//
// Some filtering is done to remove undefined, null,
// and NaN values. If no values are left after the
// filtering, the returned value is { min: NaN, max: NaN }
function findMinMax(array) {
    var initial = {
        min: Number.MAX_VALUE,
        max: -Number.MAX_VALUE
    };

    var minMax = array.reduce(
        function( prev, cur ) {
            if( typeof cur !== 'number' || isNaN(cur) ) {
                return prev;
            }
            return {
                min: Math.min( prev.min, cur ),
                max: Math.max( prev.max, cur )
            }
        },
        initial
    );

    return (minMax === initial
            ? { min: Number.NaN, max: Number.NaN }
            : minMax
    );
}

})();
