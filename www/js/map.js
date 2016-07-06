/*
	This file will contain setup, and helper functions relating to the google
	maps api.
*/

//google map object
var map;
//google map marker objects 
var markers = [];
//google map polylines to represent connections between entities.
var polylines = [];

//places service
var placesService;

/**
	Clears and then displays polylines according to the coords provided.
	2D array, pairs of points in this case. Use method buildConnections from data.js.
*/
function displayConnections(_connections) {
	//remove old polylines
	for (var x = 0; x < polylines.length; x++) {
		polylines[x].setMap(null);
	}
	polylines = [];
	//Add new polylines
	for (var x = 0; x < _connections.length; x++) {
		var pair = new google.maps.Polyline({
			path: _connections[x]['path'],
			geodesic: true,
			strokeColor: _connections[x]['strokeColor'],
			strokeOpacity: 1.0,
			strokeWeight: _connections[x]['strokeWeight']
		});
		pair.setMap(map);
		polylines.push(pair);
	}
}

/**
	Clears all markers.
*/
function clearMarkers() {
	for (var x = 0; x < markers.length; x++) {
		markers[x].setMap(null);
	}
	markers = [];
}

/**
	Adds a marker to the map.
	Simple wrapper for the google api.
*/
function addMarker(_title, _label, _position) {
	markers.push(new google.maps.Marker({
		position: _position,
		map: map,
		title: _title,
		label: _label
		}));
}

/**
	Called on initialization of the map.
*/
function initMap() {
	// set the map centered on Australia, displaying the entire country.
	map = new google.maps.Map(document.getElementById('map'), {
		center: {lat: -29.327474, lng: 135.657432},
		zoom: 5
	});
	placesService = new google.maps.places.PlacesService(map);
}
