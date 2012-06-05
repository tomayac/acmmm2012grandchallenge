(function() {
  var GOOGLE_API_KEY = 'AIzaSyC5GxhDFxBHTKCLNMYtYm6o1tiagi65Ufc';
  var EVENTFUL_KEY = 'd9RP52FGRhfSrvwN';
  var UPCOMING_KEY = 'cce931ba7e';
  
  var htmlFactory = {
    event: function(eventId, title, start, image, source) {
      return  '<div id="' + eventId + '" class="event">' +
                '<strong class="event_title">' + title + '</strong><br/>' +
                '<span class="event_source">' + source + '</span><br/>' + 
                '<time class="event_time">' + start + '</time><br/>' + 
                '<img class="event_tiny_image" src="' + image + '" />' +
              '</div>';    
    },
    media: function(mediaurl) {
      return '<br/><img class="event_media" src="' + mediaurl +'" />';
    }
  };
  
  var searchButton = document.getElementById('do_search');
  var locationInput = document.getElementById('location_search');
  var eventsSection = document.getElementById('events');
  
  var eventTitles = {};

  searchButton.addEventListener('click', function() {
    reset();
    var location = locationInput.value;
    if (location) {
      geocode(location);
    }
    return false;
  }, false);
  
  function createRandomId() {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var possibleLength = possible.length;
    for (var i = 0; i < 5; i++) {
      text += possible.charAt(Math.floor(Math.random() * possibleLength));
    }
    return text;
  }

  function reset() {
    eventsSection.innerHTML = '';
    eventTitles = {};
  }
  
  function geocode(location) {
    var url = 'https://maps.googleapis.com/maps/api/geocode/json';
    var sensor = '?sensor=false';
    var address = '&address=' + encodeURIComponent(location);
    url += sensor + address;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(data) {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          var data = JSON.parse(xhr.responseText);          
          retrieveGeocodeResults(data);
        } else {
          console.log('Error: Geocoding of the location failed.');
        }
      }
    }
    xhr.open('GET', url, true);
    xhr.send();    
  }
  
  function retrieveGeocodeResults(data) {
    if (data.results && data.results.length > 0) {
      var location = data.results[0];
      var coords = location.geometry.location;
      getPlaces(coords.lat, coords.lng, 'club');
      getEventfulEvents(coords.lat, coords.lng, '', location.formatted_address);
      getUpcomingEvents(coords.lat, coords.lng, '', location.formatted_address);
      locationInput.value = location.formatted_address;
    } else {
      // TODO: error handling
    }
  }
  
  function getUpcomingEvents(lat, long, query, formattedAddress) {
    var url =
        'http://upcoming.yahooapis.com/services/rest/?method=event.search';
    var apiKey = '&api_key=' + UPCOMING_KEY;
    var query = '&search_text=' + encodeURIComponent(query);
    var location = '&location=' + lat + ',' + long;
    var format = '&format=json';
    var limit = '&per_page=10';
    var date = '&quick_date=this_week';
    url += apiKey + query + location + format + limit + date;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(data) {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {          
          var data = JSON.parse(xhr.responseText);                    
          retrieveUpcomingEventsResults(data, formattedAddress);
        } else {
          console.log('Error: Getting Upcoming events for the coordinates failed.');
        }
      }
    }
    xhr.open('GET', url, true);
    xhr.send();        
  }
    
  function retrieveUpcomingEventsResults(data, formattedAddress) {
    if (!data.rsp) {
      return;
    }
    var events = data.rsp.event;
    var html = '';
    for (var i = 0, len = events.length; i < len; i++) {
      var e = events[i];
      var title = e.name;
      var lowerCaseTitle = title.toLowerCase();
      if (eventTitles[lowerCaseTitle]) {
        continue;
      }
      eventTitles[lowerCaseTitle] = true;
      var start = e.start_date + ' ' + e.start_time;
      var commonLocation = formattedAddress.split(',')[0];
      var eventId = 'event_' + createRandomId();
      getMediaItems(title, commonLocation, eventId);
      var image = e.photo_url;
      html += htmlFactory.event(eventId, title, start, image, 'Upcoming');
    }
    eventsSection.innerHTML += html;
  }
  
  function getEventfulEvents(lat, long, query, formattedAddress) {
    var url = 'http://api.eventful.com/rest/events/search';
    var authentication = '?app_key=' + EVENTFUL_KEY;
    var keywords = '&keywords=' + encodeURIComponent(query);
    var location = '&location=' + lat + ',' + long;
    var category = '&category=music,festivals_parades,singles_social';
    var date = '&date=Last+Week';
    var within = '&within=1';
    var units = '&units=km';
    var mature = '&mature=all';
    url += authentication + keywords + location + category + date + within +
        units + mature;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(data) {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {          
          retrieveEventfulEventsResults(xhr.responseXML, formattedAddress);
        } else {
          console.log('Error: Getting Eventful events for the coordinates failed.');
        }
      }
    }
    xhr.open('GET', url, true);
    xhr.send();        
  }
  
  function retrieveEventfulEventsResults(data, formattedAddress) {
    var events = data.getElementsByTagName('event');
    var html = '';
    for (var i = 0, len = events.length; i < len; i++) {
      var e = events[i];
      var title = e.getElementsByTagName('title')[0].textContent;
      var lowerCaseTitle = title.toLowerCase();
      if (eventTitles[lowerCaseTitle]) {
        continue;
      }
      eventTitles[lowerCaseTitle] = true;
      var start = e.getElementsByTagName('start_time')[0].textContent;
      var commonLocation = formattedAddress.split(',')[0];
      var eventId = 'event_' + createRandomId();
      getMediaItems(title, commonLocation, eventId);
      var image = '';
      try {
        image =
            e.getElementsByTagName('image')[0].getElementsByTagName('url')[0].textContent;
      } catch(e) {
        // TODO: Error handling
      }            
      html += htmlFactory.event(eventId, title, start, image, 'Eventful');
    }
    eventsSection.innerHTML += html;
  }
  
  function getPlaces(lat, long, query) {    
    var url = 'https://maps.googleapis.com/maps/api/place/search/json';
    var radius = '?radius=1000';
    var sensor = '&sensor=false';
    var location = '&location=' + lat + ',' + long;
    var keyword = '&keyword=' + encodeURIComponent(query);
    var key = '&key=' + GOOGLE_API_KEY;
    url += radius + sensor + location + keyword + key;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(data) {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          var data = JSON.parse(xhr.responseText);          
          retrievePlacesResults(data);
        } else {
          console.log('Error: Getting places for the coordinates failed.');
        }
      }
    }
    xhr.open('GET', url, true);
    xhr.send();
  }
  
  function retrievePlacesResults(data) {
    if (data.results && data.results.length > 0) {    
      // eventsSection.innerHTML += JSON.stringify(data.results, null, '  ');
    } else {
      // TODO: error handling
    }
  }
  
  function getMediaItems(title, commonLocation, eventId) {
    var url = 'http://media.no.de/search/combined/';
    url += encodeURIComponent('"' + title + '" ' + commonLocation);
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(data) {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          var data = JSON.parse(xhr.responseText);          
          retrieveMediaItemsResults(data, eventId);
        } else {
          console.log('Error: Getting media items for the query failed.');
        }
      }
    }
    xhr.open('GET', url, true);
    xhr.send();
  }
  
  function retrieveMediaItemsResults(data, eventId) {
    var eventDiv = document.getElementById(eventId);
    var socialNetworks = Object.keys(data);
    socialNetworks.forEach(function(socialNetwork) {
      var media = data[socialNetwork];
      media.forEach(function(mediaItem) {
        if (mediaItem.type === 'photo') {
          eventDiv.innerHTML += htmlFactory.media(mediaItem.mediaurl);
        }
      });
    });
  }
  
})();