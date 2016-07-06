/*
	This file contains code that powers gui and implementation specific functions.
*/

//The currently displayed json
var displayedJSON = null;

var ourDisplayColours = ['aqua', 'black', 'blue', 'fuchsia', 'gray', 
'lime', 'maroon', 'navy', 'olive', 'orange', 'purple', 'red', 
'silver', 'teal', 'white', 'yellow'];

/**
	Returns an array of objects representing name-value key pairs.
*/
function buildLegend(_json, _colours = ourDisplayColours) {
	var result = [];
	var temp = [];
	//grab the data from the json
	for (var k in _json) {
		if (_json.hasOwnProperty(k)) {
			temp = _json[k].legend;
			break;
		}
	}
	
	//work on the legend.
	for (var x = 0; x < temp.length; x++) {
		console.log(temp[x]);
		result.push({});
		result[x].name = temp[x].name;
		result[x].value = _colours[temp[x].value % _colours.length];
	}
	
	return result;
}

/**
	Extracts a 2d array of lat/lng pairs, representing lines between two points.
	
	Additionally, sets colour and weight values so we can display multiple connections.
	
*/
function buildConnections(_json, _colours = ourDisplayColours) {
	var result = [];
	//Use a object to note all connections already built.
	var built = {};
	//console.log(_json);
	for (var placeName in _json) {
		//for every connection this has
		for (var connectionName in _json[placeName]['neighbours']) {
			//if we don't already exist and we have points for both
			if (!(connectionName+'+'+placeName in built) && !(placeName+'+'+connectionName in built)
			&& _json[placeName]['coords'] != null && _json[connectionName]['coords'] != null) {
				//add to built
				built[connectionName+'+'+placeName] = null;
				
				//This gets tricky, because we want to display all of the colors.
				//For now: For every row that we got the data from, we want to be able to display the connection.
				var rowIndexs = _json[placeName]['neighbours'][connectionName];
				var addWide = 4;
				//start at 2, increment by 1 each time (but have to build from the back)
				var weight = 2 - addWide;
				for (var k in rowIndexs) {
					if (rowIndexs.hasOwnProperty(k)) {
						weight+= addWide;
					}
				}
				for (var k in rowIndexs) {
					if (rowIndexs.hasOwnProperty(k)) {
						var pair = [];
						pair.push(_json[connectionName]['coords']);
						pair.push(_json[placeName]['coords']);
						var tc = {};
						tc.strokeColor = _colours[k % _colours.length];
						tc.path = pair;
						tc.strokeWeight = weight;
						result.push(tc);
						weight-=addWide;
					}
				}
			}
		}
	}
	return result;
}

/**
	Will attempt to load coord info for places in displayedJSON.
	If _callback != null will attempt to call.
*/
function loadPlacesForJSON(_callback) {
	geocodePlaces(displayedJSON, function(geocodedJson){
		//The fail state
		if (geocodedJson == null) {
			//log status, dont touch displayedJSON
			document.getElementById('statusText').innerHTML = 'STATUS: Fatal error, failed to load places.';
			return;
		}
		displayedJSON = geocodedJson;
		console.log(displayedJSON);
		//log the amount of places we have for the object.
		var totalPlaces = 0;
		var foundPlaces = 0;
		for (var placeName in displayedJSON) {
			if (displayedJSON[placeName]['coords'] != null)
			foundPlaces++;
			totalPlaces++;
		}
		document.getElementById('statusText').innerHTML = 'STATUS: We now have a total of '+foundPlaces+' / '+totalPlaces+' places with coords.';
		if (_callback != null)
		_callback();
	});
}

/**
	Example to show how to display what we want on the map.
	
	Returns html text for a legend table.
*/
function displayJSON(_legendId = null) {
	if (_legendId != null) {
		//reload the legend
		var legend = buildLegend(displayedJSON);
		console.log(legend);
		var legendObj = document.getElementById(_legendId);
		var tbl  = document.createElement('table');
		tbl.style.width  = '100%';
		tbl.style.border = '1px solid black';
		tbl.style['background-color'] = 'rgba(255,255,255,0.6)';
		
		for (var x = 0; x < legend.length; x++) {
			var tr = tbl.insertRow();
			var key = tr.insertCell();
			key.appendChild(document.createTextNode(legend[x].name));
			key.style.border = '1px solid black';
			
			var value = tr.insertCell();
			value.style.border = '1px solid black';
			value.style['background-color'] = legend[x].value;
			value.style.paddingLeft = '40px';
		}
		
		legendObj.appendChild(tbl);
	}
	
	//clear then add markers
	clearMarkers();
	//start at '0'
	var counter = 48;
	for (var placeName in displayedJSON) {
		if (displayedJSON[placeName]['coords'] != null) {
			addMarker(placeName, String.fromCharCode(counter), displayedJSON[placeName]['coords']);
			counter++;
			if (counter == 58) {//letter block
				counter = 65;
			}
			if (counter == 91) {//letter block
				counter == 97;
			}
		}
	}
	//loads (singular instances) of connections between points
	var connections = buildConnections(displayedJSON);
	//clear then add connections
	displayConnections(connections);
}

/**
	Code to load and parse a new JSON object from csv file.
	Puts the resultant in displayedJSON.
	If _callback != null, also calls _callback on success.
*/
function loadAndParseCSV(_domString, _callback) {
	var rawFile = new XMLHttpRequest();
	rawFile.open("GET", _domString, true);
	rawFile.onreadystatechange = function () {
		if (rawFile.readyState === 4) {
			if(rawFile.status === 200 || rawFile.status == 0) {
				var allText = rawFile.responseText.trim();
				if (allText.length > 0) {
					displayedJSON = createJSONFromCSV(allText);
					console.log(displayedJSON);
					//update status
					document.getElementById('statusText').innerHTML = 'STATUS: Loaded from the csv.';
					if (_callback != null)
					_callback();
				}
			}
		}
	}
	rawFile.send(null);
}

/**
	Loads a json file into displayedJSON.
*/
function loadAndParseJSON(_domString, _callback) {
	var rawFile = new XMLHttpRequest();
	rawFile.open("GET", _domString, true);
	rawFile.onreadystatechange = function () {
		if (rawFile.readyState === 4) {
			if(rawFile.status === 200 || rawFile.status == 0) {
				var allText = rawFile.responseText.trim();
				if (allText.length > 0) {
					displayedJSON = JSON.parse(allText);
					console.log(displayedJSON);
					//update status
					document.getElementById('statusText').innerHTML = 'STATUS: Loaded from the json.';
					if (_callback != null)
					_callback();
				}
			}
		}
	}
	rawFile.send(null);
}

/**
	Runs when a file is selected, triggers parsing the csv and displaying, and loading
	from json.
*/
function handleFiles(_files) {
	//works only on the last file selected
	if (_files.length > 0) {
		
		var file = _files[_files.length - 1];
		var fType = file.name.split('.').pop().toLowerCase();
		var objUrl = window.URL.createObjectURL(file);
		if (fType == 'csv') {
			//Create a object from scratch.
			loadAndParseCSV(objUrl, function() {
				//load the places
				document.getElementById('statusText').innerHTML = 'STATUS: Loaded from the csv, attempting to load place data from google';
				loadPlacesForJSON(function() {
					//display
					displayJSON('legend');
				});
			});
			} else if (fType == 'json') {
			loadAndParseJSON(objUrl, function() {
				//display
				displayJSON('legend');
			});
			} else {
			document.getElementById('statusText').innerHTML = 'STATUS: Bad file type';
		}
	}
}				