(function() {

/**
 * Main Controller for the beryllium-mms application.
 */
angular
.module("beryllium-mms")
.controller("MainController", [
    'webGl',
    function( webGl ) {
        var ctrl = this;
        ctrl.webGlAvailable = webGl.isWebGlAvailable();
    }
]);

})();
