# Beryllium-MMS

### Beryllium-MMS Summary

Beryllium-MMS is an implementation of a Beryllium app, using the Beryllium library,
for the MMS mission. Beryllium-MMS is also known as MMS3D by many users. It displays a 3D rendering of Earth with
the MMS spacecrafts orbiting it. Users can plot various data along with the spacecrafts, usually
data collected by MMS itself, but also data generated by scientific models and other sources.

### Related Project(s)

* [beryllium](https://github.com/lasp/beryllium.git): Shared code
    for all `beryllium-*` projects (like beryllium-maven, beryllium-mms, etc)
* [beryllium-maven](https://github.com/lasp/beryllium-maven.git):
    Similar project for the Maven mission.

### Production URLs

* Production Link: https://lasp.colorado.edu/mms/sdc/public/about/3d/

### Architecture

Beryllium-MMS is an angular app that makes use of the Beryllium library. It has a sidebar
that showcases various data and allows the user to select time range, reference frame, which
MMS spacecraft is displayed, and 1D and 3D parameters for display in the `<cesium>` widget.

The following custom cesium-directives have been installed inside the `<cesium>` component:

* `<create-cesium>`: Handles the creation and configuration of the `<cesium>` widget.
* `<spacecraft-entities>`: Add Entities and Primitives to the Cesium Viewer to display the
    spacecrafts and associated data (orbit path, orbit color, orbit whiskers, etc)
* `<legend>`: Adds a legend to the Cesium Viewer to display the information about the currently
    selected data, such as its units of measurement, the corresponding color gradient, and the data range.

### Build System

* We use a standard [Gulp](https://gulpjs.com/) and [Node](https://nodejs.org/en/) build system for this project.
* You'll need to install `node_modules` before you can start by running `npm install` (requires node/npm to be installed globally on your machine).
* You'll also need to install `bower_components` before you can start by running `bower install` (requires bower to be installed globally on your machine).

##### Task Cheatsheet

```
npm run build // removes the dist folder and any/all temporary folders and then rebuilds the project to the dist folder
npm start // builds and serves the project locally, rebuilds when changes are detected
```

### Running Beryllium-MMS Locally

##### Project Dependencies

* Currently pulls data directly from a latis instance. Eventually this data will be available publicly so it will be possible to run the app from anywhere.
* A recent-ish version of node & npm
* Globally-installed bower: `sudo npm install -g bower`

### Instructions for Deploying Beryllium-MMS
1. `cd beryllium-mms`
1. `npm install`
	1. This installs all node modules that are required for this application to run.
1. `bower install`
	1. This gathers beryllium from the Github repository.
1. `npm start`

### FAQs and Help

##### Link to general LASP project faqs/help

For questions, please contact the LASP Web Application Development Team <web.support@lasp.colorado.edu>

##### Beryllium-MMS-specific common issues, gotchas

* So far we haven't figured out a great way to get "the most recent 24hrs of data" or "the most recent orbit's
    worth of data" which is what we really want to display by default when the page loads.
    Right now we use some heuristics which occasionally break and cause the page to render only a tiny sliver of an orbit.

### External Resources

* [CesiumJS Sandcastle](http://cesiumjs.org/Cesium/Apps/Sandcastle/index.html?src=Hello%20World.html&label=Showcases):
	This has lots of useful feature demos. If you need to implement something and you don't know
	what the right class is, this is a useful place to look.
* [CesiumJS API reference](http://cesiumjs.org/refdoc.html): If you know what you want to learn
	about, this is a helpful place to look.
* [CesiumJS Tutorials](http://cesiumjs.org/tutorials.html): This is a good place to start if you're
	new to CesiumJS.

#### Copyright
Copyright 2018 Regents of the University of Colorado. All rights reserved.

#### Terms of Use
Commercial use of this project is forbidden due to the terms set forth by Highstock.
