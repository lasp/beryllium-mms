(function() {

angular
.module("beryllium-mms")
.component("legend", {
    templateUrl: "components/legendComponent/legend.component.html",
    require: { cesium: "^^cesium" },
    bindings: {
        "selectedParam1d": "<",
        "selectedParam3d": "<",
        "params1d": "<",
        "params3d": "<"
    },
    controller: [
        "$scope",
        "berylliumColors",
        "inSituProvider",
        legendController
    ]
});

function legendController( $scope, berylliumColors, inSituProvider ) {
    var vm = this;

    // Sets variables of data provided by the inSituProvider
    var inSituProperties;
    inSituProvider.dataReady.addEventListener(function( _properties ) {
        inSituProperties = _properties;
        if ( inSituProperties.param1d ) {
            vm.orbitPathColormap = inSituProperties.orbitPathColormap;
            vm.minOrbitColorParam = inSituProperties.minOrbitColorParam;
            vm.maxOrbitColorParam = inSituProperties.maxOrbitColorParam;
        }
        if ( inSituProperties.param3d ) {
            vm.whiskerColormap = inSituProperties.whiskerColormap;
            vm.minWhiskerMagnitude = inSituProperties.minWhiskerMagnitude;
            vm.maxWhiskerMagnitude = inSituProperties.maxWhiskerMagnitude;
        }
    });

    //////////* Variables dealing with background gradient styles *//////////

    // Creates a computed variable for the orbit path gradient css
    Object.defineProperty(vm, 'orbitPathGradient', {
        get: function() { return berylliumColors.colorMapToCSSBackground(vm.orbitPathColormap) }
    });

    // Creates a computed variable for the whisker gradient css
    Object.defineProperty(vm, 'whiskerGradient', {
        get: function() { return berylliumColors.colorMapToCSSBackground(vm.whiskerColormap) }
    });

    //////////* Variables and functions dealing with parameter units *//////////

    // Creates a computed variable for the 1d units
    Object.defineProperty(vm, 'selectedParam1dUnits', {
        get: function() { return getParamUnits(vm.params1d, vm.selectedParam1d) }
    });

    // Creates a computed variable for the 3d units
    Object.defineProperty(vm, 'selectedParam3dUnits', {
        get: function() { return getParamUnits(vm.params3d, vm.selectedParam3d) }
    });

    // Computes the units of the given parameter
    // Returns 'No Data' if it does not exist in the given parameters object array
    function getParamUnits(params, selectedParam) {
        var param = params.find(function(param) { return param.value === selectedParam; });
        return param ? param.units : "No Data";
    }

}

})();
