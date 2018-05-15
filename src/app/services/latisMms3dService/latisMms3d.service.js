(function() {

/**
 *
 * latisMms3d service
 *
 * Provides a common access point for requesting data
 * from the latis-mms-3d server. Returns an instance of the
 * Latis class from the beryllium module that has been configured
 * for this purpose.
 *
 * Most of the logic in this module is devoted to inspecting
 * the current environment and determining what the appropriate
 * root url should be.
 */
angular.module('beryllium-mms').service(
    'latisMms3d',
    [
        '$location',
        'requestCacher',
        'Latis',
        function( $location, requestCacher, Latis ) {

            var host = $location.host();
            var path = $location.path();

            // useful because you can't use 'throw' directly in a ternary statement
            function Throw(msg) {
                msg = msg || "Programmer Error: Not Implemented";
                throw new Error(msg);
            }

            var dataServer = 'https://lasp.colorado.edu';

            var dataPath = '/mms/sdc/public/3dlatis/latis/';
            var DATA_ROOT = dataServer + dataPath;

            return new Latis( DATA_ROOT );
        }
    ]
);

})();
