(function() {

angular
.module("beryllium-mms")
.component("highstockPane", {
    templateUrl: "components/highstockPaneComponent/highstockPane.component.html",
    bindings: {
        timeframe: "<",
        selectedSpacecraft: "<",
        selectedParam1d: "<",
        selectedParam3d: "<"
    },
    controller: [
        "$scope",
        "$window",
        "$interval",
        "latis",
        "latisMms3d",
        highstockPaneController
    ],
    controllerAs: '$pane'
});

    function highstockPaneController( $scope, $window, $interval, latis, latisMms3dService ) {
        var vm = this;
        var timeFilters = null;
        var paramPlotIds = {
            "1d": [0],
            "3d": [1, 2, 3]
        };
        vm.plots = [];

        // So it doesn't have to create a new latis object
        // every time latisMavenTeamService is called
        var latisObj = latisMms3dService;

        latis.setBase(latisObj.latisBaseUrl);

        vm.$onChanges = function( changes ) {
            // Timeframe changed
            if ( changes.hasOwnProperty('timeframe') ) {
                // Takes a bit for timeframe to be set
                if(vm.timeframe.start && vm.timeframe.end) {
                    timeFilters = [
                        'time>=' + vm.timeframe.start.toISOString(),
                        'time<=' + vm.timeframe.end.toISOString()
                    ];

                    vm.timeRange = {
                        total: {start: vm.timeframe.start, end: vm.timeframe.end},
                        visible: {start: null, end: null}
                    };

                    // Update the time range for all plots
                    for (var i = 0; i < vm.plots.length; i++) {
                        vm.plots[i].plotObj.setTimeRange(vm.timeRange);
                    }
                }
            }

            // Selected 1d param changed
            if ( changes.hasOwnProperty('selectedParam1d') || changes.hasOwnProperty('selectedSpacecraft') ) {
                update1d(changes);
            }

            // Selected 3d param changed
            if ( changes.hasOwnProperty('selectedParam3d') || changes.hasOwnProperty('selectedSpacecraft') ) {
                update3d(changes);
            }
        };

        // Update 1d plot
        function update1d( changes ) {
            var param = '1d';
            if (vm.selectedParam1d === "none") { // remove 1d plot
                removePlots(paramPlotIds[param]);
            } else {
                if (vm.timeframe.start && vm.timeframe.end) { // add 1d plot
                    var dataset1d = vm.selectedSpacecraft + "_" + vm.selectedParam1d;
                    var selection1d = null; // all parameters
                    var filters1d = ["exclude_missing()"];
                    var url1d = latisObj.getUrlExtension( dataset1d, 'jsond', selection1d, filters1d );
                    var plotObj = createPlotObj(url1d, vm.selectedParam1d, '1D', ['x', 'y'], paramPlotIds[param][0], vm.timeRange, vm.menuOptions);

                    if (changes.hasOwnProperty('selectedParam1d') && changes['selectedParam1d'].previousValue === "none") {
                        vm.plots.splice(vm.plots.length, 0, plotObj);
                    } else {
                        replacePlots([plotObj]);
                    }
                }
            }
        }

        // Update 3d plots
        function update3d( changes ) {
            var param = '3d';
            if (vm.selectedParam3d === "none") { // remove 3d plots
                removePlots(paramPlotIds[param]);
            } else {
                if (vm.timeframe.start && vm.timeframe.end) { // add 3d plots
                    var dataset3d = vm.selectedSpacecraft + "_" + vm.selectedParam3d;
                    var selection3d = null; // all parameters
                    var url3d = latisObj.getUrlExtension( dataset3d, 'jsond', selection3d, [] );
                    var xPlotObj = createPlotObj(url3d, vm.selectedParam3d + "_x", '3D', ['x', 'y', null, null], paramPlotIds[param][0], vm.timeRange, vm.menuOptions); // x
                    var yPlotObj = createPlotObj(url3d, vm.selectedParam3d + "_y", '3D', ['x', null, 'y', null], paramPlotIds[param][1], vm.timeRange, vm.menuOptions); // y
                    var zPlotObj = createPlotObj(url3d, vm.selectedParam3d + "_z", '3D', ['x', null, null, 'y'], paramPlotIds[param][2], vm.timeRange, vm.menuOptions); // z

                    if (changes.hasOwnProperty('selectedParam3d') && changes['selectedParam3d'].previousValue === "none") {
                        vm.plots.splice(vm.plots.length, 0, xPlotObj, yPlotObj, zPlotObj);
                    } else {
                        replacePlots([xPlotObj, yPlotObj, zPlotObj]);
                    }
                }
            }
        }

        // Create a plot object with the given data
        function createPlotObj( accessURL, name, desc, indexes, plotId, timeRange, menuOptions) {
            var dataObj = [{
                accessURL: accessURL,
                desc: desc,
                indexes: indexes,
                name: name,
                plotId: plotId
            }];

            return {"datasets": dataObj, "timeRange": timeRange, "menuOptions": menuOptions};
        }

        // Return the plotIndex and datasetIndex of the plot with the given plotId
        function getPlotIndex( plotId ) {
            for (var i = 0; i < vm.plots.length; i++) {
                for (var j = 0; j < vm.plots[i].datasets.length; j++) {
                    if (vm.plots[i].datasets[j].plotId === plotId) {
                        return { "plotIndex": i, "datasetIndex": j };
                    }
                }
            }
            return {};
        }

        // Remove plots with the given plot IDs from the plots object
        function removePlots( plotIds ) {
            for (var i = vm.plots.length - 1; i >= 0; i--) {
                for (var j = vm.plots[i].datasets.length - 1; j >= 0; j--) {
                    if (plotIds.indexOf(vm.plots[i].datasets[j].plotId) !== - 1) {
                        if (vm.plots[i].datasets.length > 1) {
                            vm.plots[i].datasets.splice(j, 1);
                        } else {
                            vm.plots[i].plotObj.removePlot();
                        }
                    }
                }
            }
        }

        // Replace plots with their updated plots from the given plotObjs array
        function replacePlots( plotObjs ) {
            for (var i = 0; i < plotObjs.length; i++) {
                var indices = getPlotIndex(plotObjs[i].datasets[0].plotId);
                vm.plots[indices.plotIndex].datasets.splice(indices.datasetIndex, 1, plotObjs[i].datasets[0]);
            }
        }

        // Default menu options
        vm.menuOptions = {
            dataDisplay: {
                dataGrouping: false,
                gaps: {
                    enabled: true,
                    threshold: 3
                },
                filter: {
                    minmax: {
                        enabled: false,
                        min: null,
                        max: null
                    },
                    delta: {
                        enabled: false,
                        value: null
                    }
                },
                seriesDisplayMode: 'lines',
                showMinMax: true
            },
            menuDisabled: false,
            timeLabels: {
                format: 'auto',
                momentTimeFormat: 'YYYY-MM-DD',
                timezone: 'Zulu'
            },
            view: {
                legend: true,
                limits: false,
                limitViolationFlags: true,
                navigator: true
            },
            yAxis: {
                scaling: {
                    type: 'auto',
                    low: null,
                    high: null
                }
            },
            zoomMode: 'x'
        };

        /* Code related to plot auto-scrolling */

        // when the user starts to drag a plot to reorder it, listen to mouse events and watch the position of the mouse
        // so we can scroll when the user drags close to the top or bottom of the window
        var dragScrollInterval, dragScrollSpeed, dragElement;
        vm.onPlotDragStart = function( item, part, index, helper ) {
            dragElement = helper.element[0];
            // react when the user moves the cursor near the top or bottom of the main container.
            // Scroll up/down if the cursor is close enough to the edge.
            // The scroll speed is determined by how close the mouse is to the edge
            dragScrollSpeed = 0;
            $window.addEventListener( 'mousemove', onDragMouseMove );
            // set an interval to scroll 10 times/sec
            dragScrollInterval = $interval( function() {
                document.querySelector('#highstock-container').scrollTop += dragScrollSpeed;
            }, 10 );
        };

        // Remove drag scroll listeners when the element is released from dragging
        vm.onPlotDragStop = function() {
            $window.removeEventListener( 'mousemove', onDragMouseMove );
            $interval.cancel( dragScrollInterval );
        };

        // When the mouse is moved, determine what the scroll speed/direction should be
        function onDragMouseMove( e ) {
            var mainRect = document.querySelector('#highstock-container').getBoundingClientRect();
            var plotRect = dragElement.getBoundingClientRect();
            var yTop = mainRect.y || mainRect.top;
            var plotTop = plotRect.y || plotRect.top;

            var edgeThreshold = 50, // how close does the mouse need to be from the edge before it starts scrolling?
                maxScrollSpeed = 50,
                minScrollSpeed = 0,
                percentOfMaxScroll;
            if ( e.clientY < yTop + edgeThreshold ) {
                // percent is negative because we want to scroll up (adding a negative value to scrollTop)
                percentOfMaxScroll = -Math.min( 1, (yTop + edgeThreshold - e.clientY) / edgeThreshold );
            }
            // instead of watching for the user to move the mouse close to the bottom of the window, see where the
            // mouse cursor is relative to the top of the plot. A dragged plot can't disappear below the bottom of the window,
            // so when the user tries to drag a plot downward, the cursor will be far below the top of the plot
            else if ( e.clientY > plotTop + edgeThreshold ) {
                percentOfMaxScroll = Math.min( 1, (e.clientY - plotTop - edgeThreshold) / edgeThreshold );
            } else {
                percentOfMaxScroll = 0;
            }

            dragScrollSpeed = minScrollSpeed + percentOfMaxScroll * (maxScrollSpeed - minScrollSpeed);
        }
    }

})();
