(function() {

/**
 * availableDates service
 *
 * Service that looks up the available date range for the entire
 * application.
 *
 * getAvailableDateRange: requests the overall available date range from the
 *         server. Returns a promise that resolves to { first: Date, last: Date }
 *
 * onDatesAvailable: set up a listener so that things besides the original
 *         requester can also listen for when these dates become available.
 *         Returns a promise that resolves to the same object as getAvailableDateRange
 */
angular.module('beryllium-mms').service(
    'availableDates',
    [
        '$q',
        function( $q ) {

            var availableDates = null;
            var datesAvailableListeners = [];

            return {
                getAvailableDateRange: getAvailableDateRange,
                onDatesAvailable: onDatesAvailable
            };

            // Requests the overall available date range from the
            // server. Returns a promise that resolves to { first: Date, last: Date }
            function getAvailableDateRange() {
                // Make two individual requests via queryDate and then combine them
                // into a single result.
                return (
                    $q.all([
                        queryDate('first'),
                        queryDate('last')
                    ])
                    .then( function( results ) {
                        availableDates = {
                            first: results[0],
                            last: results[1]
                        };

                        datesAvailableListeners.forEach(function( listener ) {
                            listener( availableDates );
                        });

                        return availableDates;
                    })
                );
            }

            // Helper function; query a single date, either "first" or "last" which will
            // be the first or last available dates in the entire dataset.
            function queryDate( which ) {
                // These hardcoded dates should be changed at some point.
                console.warn("TODO: Implement availableDates service with actual, queried dates");

                return $q(function(resolve) {
                    setTimeout(
                        function() {

                            var now = new Date();
                            var twentySixteen = new Date(Date.UTC(
                                2016,
                                0,
                                1,
                                0,0,0,0
                            ));
                            var endOfYesterday = new Date(Date.UTC(
                                now.getUTCFullYear(),
                                now.getUTCMonth(),
                                now.getUTCDate() - 1,
                                23,
                                59,
                                59,
                                999
                            ));

                            resolve( which == "first"
                                ? twentySixteen
                                : endOfYesterday
                            );
                        },
                        500 // arbitrary: 0.5 sec
                    )
                });
            }

            // Register a listener to the onDatesAvailable event. If availableDates
            // is already available, listener will be called with that value after
            // a 0-length timeout (for consistency). Otherwise, listener will be
            // called with availableDates whenever they become available.
            function onDatesAvailable( listener ) {
                if( availableDates === null ) {
                    datesAvailableListeners.push( listener );
                }
                else {
                    setTimeout(
                        function() { listener(availableDates); },
                        0
                    );
                }
            }
        }
    ]
);

})();
