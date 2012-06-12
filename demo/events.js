(function() {
  
  // keys for the various services
  var GOOGLE_API_KEY = 'AIzaSyC5GxhDFxBHTKCLNMYtYm6o1tiagi65Ufc';
  var EVENTFUL_KEY = 'd9RP52FGRhfSrvwN';
  var UPCOMING_KEY = 'cce931ba7e';
  var TELEPORTD_KEY = 'd8b1663cdc10753314d5a9bb77ee58fe';
  var FOURSQUARE_KEY = {
    clientId: 'DQI0ZMEUX0PWZZ3WXCKIZLVK1JSPMCJITAASGBIICHJZ0DY5',
    clientSecret: 'Q11RIEPAZ2VXQLYWSHZ1GRJHM3QR43HCSS42TH51H0YDVTTL'    
  };
  
  // this objects serves as a central "templating engine" for all generated HTML
  var htmlFactory = {
    // the container for an event
    event: function(eventId, title, start, image, source) {
      var ago = humaneDate(start);
      return  '<strong class="event_title">' + title + '</strong><br/>' +
              '<span class="event_source">' + source + '</span><br/>' + 
              '<span class="event_time">' + ago + '</span><br/>' + 
              '<img class="event_tiny_image" src="' + image + '" />';
            
    },
    // the individual images that illustrate an event
    media: function(mediaurl, description, storyurl) {
      // elegant: if the image returns an error (like 404 or 403), it
      // automagically removes itself from the DOM rather than showing a "broken
      // image" icon
        return (storyurl? '<a href="' + storyurl + '">' : '') + 
               '<img class="event_media" ' + 
               'onerror="javascript:this.parentNode.removeChild(this);" ' + 
               'src="' + mediaurl +'" '+
               'title="' + description + '" />' + 
               (storyurl? '</a>' : '');
    }
  };
  
  // get DOM access to the page elements
  var searchButton = document.getElementById('do_search');
  var locationInput = document.getElementById('location_search');
  var eventsFlipbook = document.getElementById('flipbook');  
  var spinnerImage =  document.getElementById('spinner');
  var progressSpan = document.getElementById('progress');
  
  // used to store existing events when working with multiple event sources
  // in order to avoid event duplication
  var eventTitles = {};
  
  // used to store the URLs of the media items for an event
  var eventMediaItems = {};
  
  // the pages associated to each event
  var eventPages = {};
  
  // used to track pending Ajax requests
  var pendingAjaxRequests = 0;
  function requestSent(requestId) {
    pendingAjaxRequests++;
    updateProgress(pendingAjaxRequests);    
    spinnerImage.style.display = 'inline';
    progress.style.display = 'inline';
  }
  function requestReceived(requestId) {
    pendingAjaxRequests--;
    updateProgress(pendingAjaxRequests);
    if (pendingAjaxRequests === 0) {
      spinnerImage.style.display = 'none';
      progress.style.display = 'none';
    }
  }
  function updateProgress(pendingAjaxRequests) {
    progressSpan.innerHTML = pendingAjaxRequests + ' pending items to go.';
  }
  
  // add logic to the search button
  searchButton.addEventListener('click', function() {
    reset();
    searchButton.style.display = 'none';
    var location = locationInput.value;
    if (location) {
      geocode(location);
    }
    return false;
  }, false);
  
  // creates the flipbook
  (function makeFlipbook() {
    var flipbook = $('#flipbook');
    flipbook.turn({
      display: 'double',
      duration: 1000,
      acceleration: false,
      gradients: true,
      elevation: 50
    });
    var pages = flipbook.turn('pages');
    for (var i = 0; i < pages; i++) {
      flipbook.turn('removePage', i);
    }
    // react on left/right arrows
    $(window).bind('keydown', function(e) {
      if (e.keyCode === 37) {
        flipbook.turn('previous');
      } else if (e.keyCode === 39) {
        flipbook.turn('next');
      }
    });
  })(); 
    
  // helper function needed to create unique IDs
  function createRandomId() {
    var text = '';
    var possible =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var possibleLength = possible.length;
    for (var i = 0; i < 5; i++) {
      text += possible.charAt(Math.floor(Math.random() * possibleLength));
    }
    return text;
  }

  // resets the GUI and central variables
  function reset() {
    eventTitles = {};
    eventMediaItems = {};
    pendingAjaxRequests = 0;
    // initialize the flipbook
    eventPages = {};
    var flipbook = $('#flipbook');
    var pages = flipbook.turn('pages');
    for (var i = 0; i < pages; i++) {
      flipbook.turn('removePage', i);
    }
  }
  
  // gets the lat/long pair and sanitized location name for a location query
  function geocode(location) {
    var url = 'https://maps.googleapis.com/maps/api/geocode/json';
    var sensor = '?sensor=false';
    var address = '&address=' + encodeURIComponent(location);
    url += sensor + address;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        requestReceived();
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
    requestSent();
  }
  
  // retrieves lat/long pair and sanitized location name for a location query
  // gets events for a lat/long pair from different event sources
  function retrieveGeocodeResults(data) {
    searchButton.style.display = 'inline';
    
    if (data.results && data.results.length > 0) {
      var location = data.results[0];
      var coords = location.geometry.location;
      getPlaces(coords.lat, coords.lng, '');
      getFoursquareEvents(coords.lat, coords.lng, '', location.formatted_address);
      getEventfulEvents(coords.lat, coords.lng, '', location.formatted_address);
      getUpcomingEvents(coords.lat, coords.lng, '', location.formatted_address);
      locationInput.value = location.formatted_address;
    } else {
      // TODO: error handling
    }
  }
  
  // sanitizes an event's title by removing punctuation and shortening as
  // necessary
  // TODO: do more advanced sanitization for spammy titles with keyword stuffing
  function sanitizeEventTitle(title) {
    // remove punctuation and weird characters
    title = title.replace(
        /[\.,\-\?¿\/\\#!$€%\^\*;:{}=_`´'"~()®™\[\]“”…°<>]/g, '');
    // replace characters that can stand for "and" or "at" by space
    title = title.replace(/[&\+@]/g, ' ');
    return title
  }
  
  // checks if an event with a similar title already exists from a different
  // event source
  // TODO: more advanced similarity checking, e.g., by calculating the
  // Levenshtein distance
  function eventWithSimilarTitleExists(title) {
    var lowerCaseTitle = title.toLowerCase();
    if (eventTitles[lowerCaseTitle]) {
      return true;
    }
    eventTitles[lowerCaseTitle] = true;
    return false;
  }
  
  // gets events from Foursquare
  function getFoursquareEvents(lat, long, query, formattedAddress) {
    var url = 'https://api.foursquare.com/v2/venues/search';
    var ll = '?ll=' + lat + ',' + long;
    var intent = '&intent=browse';
    var radius = '&radius=5000';
    var auth1 = '&client_id=' + FOURSQUARE_KEY.clientId;
    var auth2 = '&client_secret=' + FOURSQUARE_KEY.clientSecret;
    var limit = '&limit=10';
    var now = new Date();    
    var v = '&v=' + now.getUTCFullYear() +
        (now.getUTCMonth() < 10? '0' + now.getUTCMonth() : now.getUTCMonth()) +
        (now.getUTCDate() < 10? '0' + now.getUTCDate() : now.getUTCDate());
    // see https://api.foursquare.com/v2/venues/categories? ↵
    // oauth_token=G2FJGXXRYBY2WBQEGQFT0FPAXXDT3ANN5S2JCDX0DR2GRIOT&v=20120611
    // nightlife: 4d4b7105d754a06376d81259
    // arts & entertainment: 4d4b7104d754a06370d81259
    var category =
        '&categoryId=4d4b7105d754a06376d81259,4d4b7104d754a06370d81259';
    url += ll + intent + radius + auth1 + auth2 + v + limit + category;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {        
        requestReceived();
        if (xhr.status == 200) {          
          var data = JSON.parse(xhr.responseText);                    
          retrieveFoursquareEventsResults(data, formattedAddress, lat, long);
        } else {
          console.log('Error: Getting Foursquare events for the coordinates failed.');
        }
      }
    }
    xhr.open('GET', url, true);
    xhr.send();
    requestSent();    
  }
  
  // retrieves events from Foursquare
  function retrieveFoursquareEventsResults(data, formattedAddress, lat, long) {
    if (!data.response.venues) {
      return;
    }
    var url = 'https://api.foursquare.com/v2/venues/';
    var auth1 = '?client_id=' + FOURSQUARE_KEY.clientId;
    var auth2 = '&client_secret=' + FOURSQUARE_KEY.clientSecret;
    var now = new Date();
    var v = '&v=' + now.getUTCFullYear() +
        (now.getUTCMonth() < 10? '0' + now.getUTCMonth() : now.getUTCMonth()) +
        (now.getUTCDate() < 10? '0' + now.getUTCDate() : now.getUTCDate());    
    data.response.venues.forEach(function(venue) {
      var eventUrl = url + venue.id + '/events' + auth1 + auth2 + v;
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
          requestReceived();
          if (xhr.status == 200) {
            var json = JSON.parse(xhr.responseText);
            if (!json.response.events) {
              return;
            }
            var events = json.response.events.items;
            for (var i = 0, len = events.length; i < len; i++) {
              var e = events[i];
              var title = sanitizeEventTitle(e.name);
              if (eventWithSimilarTitleExists(title)) {
                continue;
              }
              var start = new Date(e.date * 1000);
              var commonLocation = formattedAddress.split(',')[0];
              var eventId = 'event_' + createRandomId();
              if (!eventMediaItems[eventId]) {
                eventMediaItems[eventId] = {};
              }              
              var eventHtml =
                  htmlFactory.event(eventId, title, start, '', 'Foursquare');
              // use the exacter event venue location
              getMediaItems(title, commonLocation, venue.location.lat,
                  venue.location.long, eventId, eventHtml);
              // use the less exact search location
              getMediaItems(title, commonLocation, lat, long, eventId, eventHtml);                  
            }
          } else {
            console.log('Error: Getting Foursqaure events for the coordinates failed.');
          }
        }
      }
      xhr.open('GET', eventUrl, true);
      xhr.send();      
      requestSent();      
    });
  }
  
  // gets events from Upcoming
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
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        requestReceived();
        if (xhr.status == 200) {          
          var data = JSON.parse(xhr.responseText);                    
          retrieveUpcomingEventsResults(data, formattedAddress, lat, long);
        } else {
          console.log('Error: Getting Upcoming events for the coordinates failed.');
        }
      }
    }
    xhr.open('GET', url, true);
    xhr.send();        
    requestSent();    
  }
    
  // retrieves events from Upcoming
  function retrieveUpcomingEventsResults(data, formattedAddress, lat, long) {
    if (!data.rsp) {
      return;
    }
    var events = data.rsp.event;
    for (var i = 0, len = events.length; i < len; i++) {
      var e = events[i];
      var title = sanitizeEventTitle(e.name);
      if (eventWithSimilarTitleExists(title)) {
        continue;
      }
      var start = e.start_date + ' ' + e.start_time;
      var commonLocation = formattedAddress.split(',')[0];
      var eventId = 'event_' + createRandomId();
      if (!eventMediaItems[eventId]) {
        eventMediaItems[eventId] = {};
      }
      var image = e.photo_url;
      var eventHtml =
          htmlFactory.event(eventId, title, start, image, 'Upcoming');
      // use the exacter event venue location
      getMediaItems(title, commonLocation, e.latitude, e.longitude, eventId,
          eventHtml);
      // use the less exact search location
      getMediaItems(title, commonLocation, lat, long, eventId, eventHtml);
    }
  }
  
  // gets events from Eventful
  function getEventfulEvents(lat, long, query, formattedAddress) {
    var url = 'http://api.eventful.com/rest/events/search';
    var authentication = '?app_key=' + EVENTFUL_KEY;
    var keywords = '&keywords=' + encodeURIComponent(query);
    var location = '&location=' + lat + ',' + long;
    var category = '&category=music,festivals_parades,singles_social';
    var date = '&date=Last+Week';
    var within = '&within=10';
    var units = '&units=km';
    var mature = '&mature=all';
    url += authentication + keywords + location + category + date + within +
        units + mature;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        requestReceived();
        if (xhr.status == 200) {          
          retrieveEventfulEventsResults(
              xhr.responseXML, formattedAddress, lat, long);
        } else {
          console.log('Error: Getting Eventful events for the coordinates failed.');
        }
      }
    }
    xhr.open('GET', url, true);
    xhr.send();        
    requestSent();
  }
  
  // retrieves events from Eventful
  function retrieveEventfulEventsResults(data, formattedAddress, lat, long) {
    var events = data.getElementsByTagName('event');
    for (var i = 0, len = events.length; i < len; i++) {
      var e = events[i];
      var title = sanitizeEventTitle(
          e.getElementsByTagName('title')[0].textContent);
      if (eventWithSimilarTitleExists(title)) {
        continue;
      }
      var start = e.getElementsByTagName('start_time')[0].textContent;
      var latitude = e.getElementsByTagName('latitude')[0].textContent;
      var longitude = e.getElementsByTagName('longitude')[0].textContent;
      var commonLocation = formattedAddress.split(',')[0];
      var eventId = 'event_' + createRandomId();
      if (!eventMediaItems[eventId]) {
        eventMediaItems[eventId] = {};
      }      
      var imageSrc = '';
      if ((e.getElementsByTagName('image')) &&
          (e.getElementsByTagName('image').length > 0)) {
        var image = e.getElementsByTagName('image')[0];
        if ((image.getElementsByTagName('url')) &&
            (image.getElementsByTagName('url').length > 0)) {
          imageSrc = image.getElementsByTagName('url')[0].textContent;
        }
      }
      var eventHtml =
          htmlFactory.event(eventId, title, start, imageSrc, 'Eventful');
      // use the exacter event venue location
      getMediaItems(title, commonLocation, latitude, longitude, eventId,
          eventHtml);
      // use the less exact search location
      getMediaItems(title, commonLocation, lat, long, eventId,
          eventHtml);
          
    }
  }
  
  // gets (places and) events from Google Places
  function getPlaces(lat, long, query) {    
    var url = 'https://maps.googleapis.com/maps/api/place/search/json';
    var radius = '?radius=1000';
    var sensor = '&sensor=false';
    var location = '&location=' + lat + ',' + long;
    var keyword = '&keyword=' + encodeURIComponent(query);
    var key = '&key=' + GOOGLE_API_KEY;
    url += radius + sensor + location + keyword + key;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        requestReceived();
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
    requestSent();    
  }
  
  // retrieves (places and) events from Google Places
  function retrievePlacesResults(data) {
    if (data.results && data.results.length > 0) {    
      // TODO: check for events
      // event data for places seems very sparse
    } else {
      // TODO: error handling
    }
  }
  
  // gets media items for a given event title and/or lat/long pair
  function getMediaItems(title, commonLocation, lat, long, eventId, eventHtml) {
    getNodeMediaItems(title, commonLocation, eventId, eventHtml);
    // getTeleportdMediaItems(title, lat, long, eventId, eventHtml); // ficken
  }

  // gets media items from Teleportd that match a given lat/long pair and event
  // title
  function getTeleportdMediaItems(title, lat, long, eventId, eventHtml) {
    var url = 'http://api.teleportd.com/search';
    var authentication = '?user_key=' + TELEPORTD_KEY;
    var location = '&loc=[' + lat + ',' + long + ',5.0,5.0]';
    var query = '&str=' + encodeURIComponent(title);
    url += authentication + location + query;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        requestReceived();
        if (xhr.status == 200) {
          var data = JSON.parse(xhr.responseText);
          retrieveTeleportdMediaItemsResults(data, eventId, eventHtml);
        } else {
          console.log('Error: Getting media items for the query failed.');
        }
      }
    }
    xhr.open('GET', url, true);
    xhr.send();
    requestSent();    
  }
  
  // adds a new page to the flipbook and returns it
  function addPage(pageHtml) {
    var page = $('<div>').html(pageHtml);
    $('#flipbook').turn('addPage', page);
    return page;
  }
  
  // retrieves media items from Teleportd
  function retrieveTeleportdMediaItemsResults(data, eventId, eventHtml) {
    if (data.hits && data.hits.length) {
      var flipbook = $('#flipbook');        
      if (!eventPages[eventId]) {
        eventPages[eventId] = addPage(eventHtml);
      }
      var html = eventPages[eventId].html();
      data.hits.forEach(function(mediaItem) {
        if (mediaItem.typ === 'image') {
          // TODO: check if there is a way to get the description and story URL
          if (!eventMediaItems[eventId][mediaItem.fll]) {
            html += htmlFactory.media(mediaItem.fll, '', '');
            eventMediaItems[eventId][mediaItem.fll] = true;
          }
        }
      });   
      eventPages[eventId].html(html);
    }
  }
  
  // gets media items from our node.js Media Server that match a given event
  // title and sanitized location name
  function getNodeMediaItems(title, commonLocation, eventId, eventHtml) {
    var url = 'http://media.no.de/search/combined/';
    url += encodeURIComponent(title + ' ' + commonLocation);
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        requestReceived();
        if (xhr.status == 200) {
          var data = JSON.parse(xhr.responseText);          
          retrieveNodeMediaItemsResults(data, eventId, eventHtml);
        } else {
          console.log('Error: Getting media items for the query failed.');
        }
      }
    }
    xhr.open('GET', url, true);
    xhr.send();
    requestSent();
  }
  
  // retrieves media items from our node.js Media Server
  function retrieveNodeMediaItemsResults(data, eventId, eventHtml) {
    var socialNetworks = Object.keys(data);
    // check if we have events at all, a bit ugly, but works
    var eventsExist = false;
    for (var i = 0, len = socialNetworks.length; i < len; i++) {
      var media = data[socialNetworks[i]];
      if (media.length) {
        eventsExist = true;
        break;
      }      
    }
    if (eventsExist) {
      var flipbook = $('#flipbook');
      if (!eventPages[eventId]) {
        eventPages[eventId] = addPage(eventHtml);
      }
      var html = eventPages[eventId].html();
      socialNetworks.forEach(function(socialNetwork) {
        var media = data[socialNetwork];
        media.forEach(function(mediaItem) {
          if (mediaItem.type === 'photo') {
            if ((!eventMediaItems[eventId][mediaItem.mediaurl]) &&
                // TODO: very lame way to remove spammy messages with just too
                // much characters
                (mediaItem.message.clean.length <= 500)) {
              html += htmlFactory.media(
                  mediaItem.mediaurl,
                  mediaItem.message.clean,
                  mediaItem.storyurl);
              eventMediaItems[eventId][mediaItem.mediaurl] = true;
            }
          }
        });
      });      
      eventPages[eventId].html(html);
    }
  }
  
  // TODO: deduplicate media items
  function deduplicteMediaItems() {
    
  } 
  
})();