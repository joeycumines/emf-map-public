/*
	This file will contain methods and tools for parsing, storing, and 
	accessing the data, for the map application.
*/

/*
	Define: Storage in json.
	- Data from the csv will be stored as a json object.
		- Allows easy transfer and easy to work with.
	
	NOTE null as in no field for that.
	
	{
		//Object representing an institution. Keyed so we can use it to do unique entries easily.
		//There is some loss of data here, but at this point we don't need it.
		"Royal Brisbane and Women's Hospital" :
		{
			//object representing an institution
			
			//name field from csv
			'name': "Royal Brisbane and Women's Hospital",
			//coords field consisting of a lat/lng key pair that must be found through google.
			'coords' : {'lat': -29.327474, 'lng': 135.657432} || null,
			//geocoding info cached from google's api
			'geocoding' : {},
			//neighbours, keys that will be referenced at the higher level. 'there is a direct line to here'
			'neighbours' : {"Royal Brisbane and Women's Hospital" = [], "Pathology Qld, Herston" = []}
		}
	}
*/

/**
	Helper function for building the json object.
*/
function newInstitution(_name) {
	var result = {};
	result['name'] = _name;
	result['coords'] = null;
	result['geocoding'] = null;
	result['neighbours'] = {};
	return result;
}

/**
	Parses a csv file, and returns an object in the structure defined above.
*/
function createJSONFromCSV(_csvString) {
	var result = {};
	var legend = [];
	var parsed = _csvString.csvToArray();
	//we have our data, walk rows until we match the start of 'APPLICATION ID,PI,HOSP' (the header).
	var pastHeader = false;
	//headerRow used to store the row the header was found.
	var headerRow = -1;
	for (var x = 0; x < parsed.length; x++) {
		var row = parsed[x];
		//we only start parsing once we find a matching header.
		if (pastHeader) {
			var primaryInst = row[2].trim();
			if (primaryInst != '') {
				
				//add as legend
				var leg = {};
				leg.name = '#'+(legend.length+1)+' '+primaryInst;
				leg.value = x;
				legend.push(leg);
				
				//Create a institution entry for this row's PI
				if (!(primaryInst in result)) {
					result[primaryInst] = newInstitution(primaryInst);
				}
				//for every second column from 4 to the end, we check to see if already added, and add relationships
				for (var y = 4; y < row.length; y+=2) {
					var clientInst = row[y].trim();
					if (clientInst != '') {
						//No institution entry for this.
						if (!(clientInst in result)) {
							result[clientInst] = newInstitution(clientInst);
						}
						//add a reference between client and primary inst, and primary and client.
						if (!( clientInst in result[primaryInst]['neighbours'])) {
							var tempCon = {};
							tempCon[x] = true;
							result[primaryInst]['neighbours'][clientInst] = tempCon;
						} else {
							result[primaryInst]['neighbours'][clientInst][x] = true;
						}
						if (!( primaryInst in result[clientInst]['neighbours'])) {
							var tempCon = {};
							tempCon[x] = true;
							result[clientInst]['neighbours'][primaryInst] = tempCon;
						} else {
							result[clientInst]['neighbours'][primaryInst][x] = true;
						}
					}
				}
			}
		} else {
			//check for match
			if (row.length >= 3 && row[0].trim().toUpperCase() == 'APPLICATION ID'
					&& row[1].trim().toUpperCase() == 'PI'
					&& row[2].trim().toUpperCase() == 'HOSP') {
				pastHeader = true;
				headerRow = x;
			}
		}
	}
	
	console.log(legend);
	
	//for every result, push legend.
	for (var k in result) {
		if (result.hasOwnProperty(k)) {
			result[k].legend = legend;
		}
	}
	return result;
}

//START of code for google place api lookup
/*
	Code flow and usage:
	
	Entry point: geocodePlaces(_json, _callback)
	Steps:
	1. Creates a reference to the json, must be in the structure defined at the start of this script.
	2. Registers the callback function (One parameter, the resultant json).
	3. Creates a temporary map of the results for each place in the json.
	4. Creates a empty queue to store the next place to search for in, for all places without location.
	5. runNextGeocodePlacesQuery() recursively run (using callbacks).
	6. If there are any left,
		a. Text searches for the first place name in the queue + 'Australia'.
		b. On complete, if the status is not OK,
			i. If the status is not ZERO_RESULTS it means we had a fatal error, CALLSBACK WITH A NULL OBJECT, AND STOPS.
			ii. If the status is ZERO_RESULTS, then we move on without storing.
		c. We are OK, add the result to the working object geocodePlacesWorking
		d. Shift the first one out, call runNextGeocodePlacesQuery again.
	7. We have none left in queue.
	8. For every place in the starting json, we check to see if we have a result for it.
		a. We have a result(s)
		b. Store the result(s) under geocoding
		c. Store the coords of the first result as coords
		
	Exit possibilities: 
	1. Success, all places now have coords
	2. Partial success, we didn't have a fatal error but one or more places didnt get coords.
	3. Failure, fatal error with the google service.
	
	result 1 and 2 pass to the callback a (version) of the original json, 3 passes null.
	
	In the event that geocodePlaces is called again while running, there should not be a problem,
	unless there is a high volume which will result in simultaneous queries that exceed the api'
	key's limit and result in failure.
*/

var geocodePlacesQueue = [];
var geocodePlacesWorking = null;
var geocodePlacesTemp = null;
var geocodePlacesFinishedCallback = null;

/**
	Internal method to call the next query in the queue, and finish up if we dont need to.
*/
function runNextGeocodePlacesQuery() {
	//if we still have some in the queue then cont.
	if (geocodePlacesQueue.length <= 0){
		//We are done, finish
		//Add details from working to temp
		for (var placeName in geocodePlacesTemp) {
			if (placeName in geocodePlacesWorking && geocodePlacesWorking[placeName].length > 0) {
				geocodePlacesTemp[placeName]['geocoding'] = geocodePlacesWorking[placeName];
				geocodePlacesTemp[placeName]['coords'] = geocodePlacesWorking[placeName][0]['geometry']['location'];
			}
		}
		//run the finished callback
		geocodePlacesFinishedCallback(geocodePlacesTemp);
		return;
	}
	//start first query
	var request = {query: geocodePlacesQueue[0]};
	placesService.textSearch(request, geocodePlacesCallback);
}

/**
	Internal callback function to run on the retrieval of a place.
*/
function geocodePlacesCallback(results, status) {
	//Anything but OK or ZERO_RESULTS (fatal error) we exit
	if (status != 'OK' && status != 'ZERO_RESULTS') {
		console.log('('+status+')Failed to retrieve places data for "'+geocodePlacesQueue[0]+'"');
		//Call the final callback with a null object
		geocodePlacesFinishedCallback(null);
		return;
	}
	if (status == 'OK' && results.length > 0){
		//Add to working if we had results
		geocodePlacesWorking[geocodePlacesQueue[0]] = results;
	}
	//shift the last place out
	geocodePlacesQueue.shift();
	//run more if we need
	runNextGeocodePlacesQuery();
}

/**
	Uses the google API to do some geocoding, for null fields in the defined json object.
	Requires the map.js.
	
	Callback format _callback(returnedJson);
*/
function geocodePlaces(_json, _callback) {
	geocodePlacesFinishedCallback = _callback;
	geocodePlacesWorking = {};
	geocodePlacesTemp = _json;
	geocodePlacesQueue = [];
	//for every null location field we update
	for (var placeName in _json) {
		if (_json[placeName]['coords'] == null) {
			//add to queue
			geocodePlacesQueue.push(placeName);
		}
	}
	runNextGeocodePlacesQuery();
}

//END of code for google place api lookup

/**
	Saves the given object to a text file in json format.
*/
function saveJSONToFile(_json, _fileName) {
	var blob = new Blob([JSON.stringify(_json)], {type: "text/plain;charset=utf-8"});
	saveAs(blob, _fileName);
}
