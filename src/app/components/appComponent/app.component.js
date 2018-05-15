(function() {

angular
.module("beryllium-mms")
.component("app", {
    templateUrl: "components/appComponent/app.component.html",
    controller: [
        "availableDates",
        "mms3dConstants",
        AppController
    ]
});

function AppController( availableDates, constants ) {
    var vm = this;

    vm.selectedReferenceFrame = "inertial";
    vm.cesiumViewer = null; // will be initialized when available
    vm.selectedSpacecraft = "mms1";

    vm.params1d = constants.ORBIT_COLOR_PARAMETERS.map(function(param) {
        return {
            value: param.id,
            display: param.name,
            units: param.units
        }
    });
    vm.selectedParam1d = "none";

    vm.params3d = constants.ORBIT_WHISKER_PARAMETERS.map(function(param) {
        return {
            value: param.id,
            display: param.name,
            units: param.units
        }
    });
    vm.selectedParam3d = "none";

    // Hide or show the legend container based on whether a parameter is set
    vm.showLegendButton = function() {
        if(vm.selectedParam1d !== 'none' || vm.selectedParam3d !== 'none') {
            angular.element(document.querySelector('#legend-container')).css('display', 'block');
        } else {
            angular.element(document.querySelector('#legend-container')).css('display', 'none');
        }
    };

    // availableDates: min/max dates for the entire dataset
    // displayDates: min/max dates currently being shown by the <date-range-picker>
    // requestedDates: When the user hits the Reload button in the <date-range-picker>
    //        the requested dates will be copied to this object. Components may watch
    //        this object for changes and loads new data when changes
    //        are detected.
    vm.availableDates = { start: null, end: null };
    vm.displayDates = { start: null, end: null };
    vm.requestedDates = { start: null, end: null };

    availableDates.getAvailableDateRange().then(function( availableDates ) {
        var start = availableDates.first;
        var end = availableDates.last;

        vm.availableDates = {
            start: start,
            end: end
        };

        // Default to the 2nd most recent 24hrs of data
        vm.displayDates = {
            start: new Date( end.getTime() - 2*24*60*60*1000 ),
            end: new Date( end.getTime() - 24*60*60*1000 )
        };

        // Normally these only change when the user hits the Submit button
        // on the datepicker widget, but for all the components that watch
        // for changes to this value this can serve as a useful first-time
        // initialization.
        vm.requestedDates = {
            start: vm.displayDates.start,
            end: vm.displayDates.end
        };
    });

    // Callback from the <date-range-picker>: when the user hits Reload
    // update the requestedDates variable. Other elements watch for changes
    // to this variable
    vm.onDateRangeChanged= function( start, end ) {
        vm.requestedDates = {
            start: start,
            end: end
        };
    };

    // Callback from the <cesium> component: when the Cesium.Viewer is ready
    // store a reference to it on the vm.
    vm.setCesiumViewer = function( cesiumViewer ) {
        vm.cesiumViewer = cesiumViewer;
    };

    // Callback from the <cesium> component: when the Cesium.Clock instance changes
    // its start/end dates, update the dates in the <date-range-picker>
    vm.setDisplayDates = function( timeframe ) {
        vm.displayDates = angular.copy( timeframe );
    };
}

})();
