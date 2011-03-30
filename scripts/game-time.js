require("datejs/date"); // www.datejs.com - an open-source JavaScript Date Library.

var dmz =
       { object: require("dmz/components/object")
       , time: require("dmz/runtime/time")
       , defs: require("dmz/runtime/definitions")
       , data: require("dmz/runtime/data")
       , module: require("dmz/runtime/module")
       , util: require("dmz/types/util")
       , stance: require("stanceConst")
       }
    , DateJs = require("datejs/time")
    // Constants
    , OnServerStartTimeAttr = dmz.stanceConst.OnServerStartTimeHandle
    , OnServerEndTimeAttr = dmz.stanceConst.OnServerEndTimeHandle
    , InGameStartTimeAttr = dmz.stanceConst.InGameStartTimeHandle
    , InGameEndTimeAttr = dmz.stanceConst.InGameEndTimeHandle
    // Variable
    , _exports = {}
    , _game = {}
    , _gameTime = {}
    // Fuctions
    , toDate = dmz.util.timeStampToDate
    , toTimeStamp = dmz.util.dateToTimeStamp
    , _setupTestData
    , _calculateGameTime
    , _calculateWeekendGameTime
    , _lookupGameTime
    , _updateGameTime
    , _updateGameTimeStamps
    ;

dmz.object.create.observe(self, function (handle, type) {

   if (type.isOfType(dmz.stanceConst.GameType)) {

      if (!_game.handle) { _game.handle = handle; }
   }
});

dmz.object.flag.observe(self, dmz.stanceConst.ActiveHandle, function (handle, attr, value) {

   if (handle === _game.handle) { _game.active = value; }
});

dmz.object.data.observe(self, dmz.stanceConst.GameTimeHandle,
function (handle, attr, value) {

   if (handle === _game.handle) {

      _gameTime.onServer = {
         start: value.number("onServer", 0),
         end: value.number("onServer", 1),
      };

      self.log.warn("onServer.start: " + toDate(_gameTime.onServer.start));
      self.log.warn("onServer.end: " + toDate(_gameTime.onServer.end));

      _gameTime.inGame = {
         start: value.number("inGame", 0),
         end: value.number("inGame", 1)
      };

      self.log.warn("inGame.start: " + toDate(_gameTime.inGame.start));
      self.log.warn("inGame.end: " + toDate(_gameTime.inGame.end));
   }
});

_calculateGameTime = function (today) {

   var server = _gameTime.onServer
     , game = _gameTime.inGame
     ;

   self.log.info("game.time: " + toDate(game.time));
   self.log.warn("calculateGameTime: " + today);
};


_calculateWeekendGameTime = function (today) {

   var segment = _gameTime[_segment]
     , nextSegment = _gameTime[_segment+1]
     , server = {}
     , game = {}
     ;

   server.prevDate = toDate(segment.serverDate);
   server.timeSpan = new DateJs.TimeSpan(today - server.prevDate);

   game.start = toDate(segment.endDate);
   game.start.addDays(server.timeSpan.getDays());

   game.time = game.start.clone().set(
      { millisecond: today.getMilliseconds()
      , second: today.getSeconds()
      , minute: today.getMinutes()
      , hour: today.getHours()
      }
   );

   game.time = toTimeStamp(game.time);
   game.factor = 1;

   game.start = nextSegment.startDate + (nextSegment.startHour * OneHour);

   game.nextUpdate = game.start - game.time;

   return game;
};

_lookupGameTime = function (today) {

   var segment = _gameTime[_segment]
     , server = {}
     , game = {}
     , time = {}
     , nextSegment
     ;

self.log.warn("_lookupGameTime: " + today);

   if ((today.getDay () === 0) || (today.getDay () === 6)) {

      game = _calculateWeekendGameTime (today);
   }
   else {

      time.now =
         (today.getHours () * OneHour) +
         (today.getMinutes() * OneMinute) +
         today.getSeconds();

      time.start = (segment.startHour * OneHour);
      time.end = (segment.endHour * OneHour);

      // real time
      if (time.now < time.start) {

self.log.warn("realTime start of day: " + today);

         game.start = toDate(segment.startDate);

         game.time = game.start.clone().set(
            { millisecond: today.getMilliseconds()
            , second: today.getSeconds()
            , minute: today.getMinutes()
            , hour: today.getHours()
            }
         );

         game.time = toTimeStamp(game.time);
         game.factor = 1;

         game.start.setHours(segment.startHour);
         game.start = toTimeStamp(game.start);

         game.nextUpdate = game.start - game.time;
      }
      else if (time.now >= time.end) {

self.log.warn("realTime end of day: " + today);

         game.end = toDate(segment.endDate);

         game.time = game.end.clone().set(
            { millisecond: today.getMilliseconds()
            , second: today.getSeconds()
            , minute: today.getMinutes()
            , hour: today.getHours()
            }
         );

         game.time = toTimeStamp(game.time);
         game.factor = 1;

         nextSegment = _gameTime[_segment+1];

         game.start = nextSegment.startDate + (nextSegment.startHour * OneHour);

         game.nextUpdate = game.start - game.time;
      }
      else { // hyper time

self.log.warn("hyperTime: " + today);

         server.start = segment.serverDate + (segment.startHour * OneHour);
         server.end = segment.serverDate + (segment.endHour * OneHour);
         server.now = toTimeStamp(today);

         game.start = segment.startDate + (segment.startHour * OneHour);
         game.end = segment.endDate + (segment.endHour * OneHour);

         server.delta = server.end - server.start;
         game.delta = game.end - game.start;

         game.factor = game.delta / server.delta;

         server.scale = (server.now - server.start) / server.delta;

         game.time = game.start + (game.delta * server.scale);

         game.nextUpdate = game.delta * (1 - server.scale);
      }
   }

   self.log.info("Setting game time: " + toDate(game.time));
   dmz.time.setFrameTime(game.time);

   self.log.info("Setting game time factor: " + game.factor);
   dmz.time.setTimeFactor(game.factor);

   self.log.info("Next game time update in: " + game.nextUpdate/OneHour + " hours (" + game.nextUpdate + ")");
   if (game.nextUpdate < 10.0) { game.nextUpdate = 30.0; }

   dmz.time.setTimer (self, game.nextUpdate, function (DeltaTime) {

      var delta = Math.abs (DeltaTime - game.time);

      // this gets called to soon on first time because setFrameTime is called on the next sync,
      // so lets not do anything if game.time is really close to Delta time -ss
      if (delta < 10.0) {

         dmz.time.setTimer(self, game.nextUpdate, _updateGameTime);
      }
      else { _updateGameTime(); }
   });
};

_updateGameTime = function () {

   var now = _exports.serverTime()
     , today = toDate(now)
     , current = _segment
     , currentDate
     , nextDate
     , found = false
     ;

   self.log.error("_updateGameTime: " + today);

   if (_game.handle && _game.active) {

      while (!found && (current < _gameTime.length)) {

         currentDate = toDate(_gameTime[current].serverDate).clearTime();

         if ((current + 1) < _gameTime.length) {

            nextDate = toDate(_gameTime[current+1].serverDate).clearTime();
         }
         else { nextDate = false }

         if (nextDate && today.between(currentDate, nextDate)) {

            _segment = current;
            found = true;
         }

         current += 1;
      }

      if (found) {

         _lookupGameTime(today);
      }
      else {

         _segment = _gameTime.length - 1;
         _calculateGameTime(today);

self.log.error("not found: " + _segment);

         // FIXME: calculate for real
         //dmz.time.setFrameTime(_serverTime);
         //dmz.time.setTimeFactor(1.0);
      }
   }
   else {

      dmz.time.setFrameTime(now);
      dmz.time.setTimeFactor(1.0);
   }
};

//dmz.object.timeStamp.observe(self, dmz.stanceConst.ServerTimeHandle,
//function (handle, attr, value) {

//   if ((handle === _game.handle) && _game.active) {

//      self.log.warn("serverTime: " + value);
//   }
//});

//dmz.object.timeStamp.observe(self, dmz.stanceConst.GameTimeHandle,
//function (handle, attr, value) {

//   if (handle === _game.handle) {

//      dmz.time.setFrameTime(value);
//self.log.warn("gameTime: " + dmz.util.timeStampToDate(value));
//   }
//});

//dmz.object.scalar.observe(self, dmz.stanceConst.GameTimeFactorHandle,
//function (handle, attr, value) {

//   if (handle === _game.handle) {

//      dmz.time.setTimeFactor(value);
//self.log.warn("gameTimeFactor: " + value);
//   }
//});

_updateGameTimeStamps = function () {

   var local = _exports.localTime()
     , server = _exports.serverTime()
     , game = _exports.gameTime()
     , delta = server - local;
     ;

   if (_game.handle) {

      if (Math.abs(delta) < 0.1) { delta = 0.0; }

      dmz.object.counter(_game.handle, "local_time_delta", delta);
      dmz.object.timeStamp(_game.handle, dmz.stanceConst.LocalTimeHandle, local);
      dmz.object.timeStamp(_game.handle, dmz.stanceConst.ServerTimeHandle, server);
      dmz.object.timeStamp(_game.handle, dmz.stanceConst.GameTimeHandle, game);
   }
};

//dmz.time.setRepeatingTimer (self, UpdateInterval, _updateGameTimeStamps);

_exports.localTime = function () {

   return new Date();
};

_exports.gameTime = function () {

   return toDate(dmz.time.getFrameTime());
};

_exports.serverTime = function () {

   return dmz.time.getFrameTime();
};

_exports.setServerTime = function (timeStamp) {

   var time = dmz.time.getSystemTime()
     , local = toTimeStamp(new Date())
     , delta


   if (timeStamp) {

      if (timeStamp instanceof Date) { timeStamp = toTimeStamp(timeStamp); }

      _setupTestData();

//      _serverTime = timeStamp;

//      if (_game.handle) {

//         delta = _serverTime - local;
//         if (Math.abs(delta) < 0.1) { delta = 0.0; }

//         dmz.object.timeStamp(_game.handle, "local_time", local);
//         dmz.object.counter(_game.handle, "local_time_delta", delta);

//         self.log.info(" Local time: " + toDate(local) + " (" + (delta) + ")");
//      }

//      self.log.info("Server time: " + toDate(_serverTime));

//      _updateGameTime();
//      _updateGameTimeStamps();
   }
   else {

//      _serverTime += (time - _lastTime);
   }

//   _lastTime = time;

//   return _serverTime;
};


// Publish module
dmz.module.publish(self, _exports);

_setupTestData = function () {

   var onServer = { start: Date.parse("3/28/11"), end: Date.parse("4/1/12") }
     , inGame = { start: Date.parse("1/1/12"), end: Date.parse("1/31/12") }
     , data = dmz.data.create()
     ;

   data.number("onServer", 0, toTimeStamp(onServer.start));
   data.number("onServer", 1, toTimeStamp(onServer.end));
   data.number("inGame", 0, toTimeStamp(inGame.start));
   data.number("inGame", 1, toTimeStamp(inGame.end));
   dmz.object.data(_game.handle, dmz.stanceConst.GameTimeHandle, data);

   dmz.object.timeStamp(_game.handle, OnServerStartTimeAttr, toTimeStamp(onServer.start));
   dmz.object.timeStamp(_game.handle, OnServerEndTimeAttr, toTimeStamp(onServer.end));
   dmz.object.timeStamp(_game.handle, InGameStartTimeAttr, toTimeStamp(inGame.start));
   dmz.object.timeStamp(_game.handle, InGameEndTimeAttr, toTimeStamp(inGame.end));
};
