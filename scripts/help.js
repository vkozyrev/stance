require("datejs/date"); // www.datejs.com - an open-source JavaScript Date Library.

var dmz =
       { defs: require("dmz/runtime/definitions")
       , module: require("dmz/runtime/module")
       , object: require("dmz/components/object")
       , objectType: require("dmz/runtime/objectType")
       , message: require("dmz/runtime/messaging")
       , resources: require("dmz/runtime/resources")
       , stance: require("stanceConst")
       , time: require("dmz/runtime/time")
       , util: require("dmz/types/util")
       , ui:
          { consts: require('dmz/ui/consts')
          , graph: require("dmz/ui/graph")
          , layout: require("dmz/ui/layout")
          , label: require("dmz/ui/label")
          , loader: require('dmz/ui/uiLoader')
          , messageBox: require("dmz/ui/messageBox")
          , mainWindow: require("dmz/ui/mainWindow")
          }
       , forumView: require("static-forum-view")
       }

   // Variables
   , RetData = false
   , LoginSkippedMessage = dmz.message.create("Login_Skipped_Message")
   , LoginSkipped = false
   , MaxMessageLength = 2000
   ;

LoginSkippedMessage.subscribe(self, function (data) { LoginSkipped = true; });

dmz.module.subscribe(self, "main", function (Mode, module) {

   var forumData;
   if (Mode === dmz.module.Activate) {

      forumData =
         { self: self
         , postType: dmz.stance.PostType
         , commentType: dmz.stance.CommentType
         , timeHandle: dmz.stance.HelpTimeHandle
         , forumType: dmz.stance.HelpForumType
         , parentHandle: dmz.stance.ParentHandle
         , groupLinkHandle: dmz.stance.HelpLink
         , highlight: function (handle) { module.highlight("Help"); }
         , canReplyTo: function () { return dmz.stance.isAllowed(dmz.object.hil(), dmz.stance.AnswerHelpFlag); }
         , postBlocked: function () {

              var allowed = dmz.stance.isAllowed(dmz.object.hil(), dmz.stance.ForumPostFlag);
              return allowed ? false : "You do not have permission to post here.";
           }
         , messageLength: MaxMessageLength
         };
      RetData = dmz.forumView.setupForumView(forumData);

      dmz.object.create.observe(self, RetData.observers.create);
      dmz.object.text.observe(self, dmz.stance.TextHandle, RetData.observers.text);
      dmz.object.timeStamp.observe(self, dmz.stance.CreatedAtServerTimeHandle, RetData.observers.createdAt);
      dmz.object.link.observe(self, dmz.stance.CreatedByHandle, RetData.observers.createdBy);
      dmz.object.link.observe(self, dmz.stance.HelpLink, RetData.observers.forumLink);
      dmz.object.link.observe(self, dmz.stance.ParentHandle, RetData.observers.parentLink);
      dmz.object.flag.observe(self, dmz.stance.ActiveHandle, RetData.observers.onActive);
      dmz.object.data.observe(self, dmz.stance.TagHandle, RetData.observers.tag);
      dmz.object.state.observe(self, dmz.stance.Permissions, RetData.observers.permissions);

      dmz.object.link.observe(self, dmz.stance.GroupMembersHandle,
      function (linkObjHandle, attrHandle, userHandle, groupHandle) {

         if (dmz.object.hil() === userHandle) {

            RetData.updateForUser(userHandle);
            RetData.checkHighlight();
         }
      });

      dmz.object.flag.observe(self, dmz.object.HILAttribute,
      function (objHandle, attrHandle, value) {

         var type = dmz.object.type(objHandle);
         if (value && type && type.isOfType(dmz.stance.UserType)) {

            RetData.updateForUser(objHandle);
            RetData.checkHighlight();
         }
      });

      if (RetData && RetData.update && RetData.onHome && RetData.widget) {

         module.addPage
            ( "Help"
            , RetData.widget
            , function (width, height) { RetData.update(); }
            , RetData.onHome
            );
      }
   }
});

// Update clean databases for new data structures
dmz.time.setTimer(self, 20, function () {

   var objs = dmz.object.getObjects() || [];
   objs = objs.filter(function (handle) {

      return dmz.object.type(handle).isOfType(dmz.stance.GroupType) && !dmz.object.superLinks(handle, dmz.stance.HelpLink);
   });
   objs.forEach(function (group) {

      var handle;
      self.log.warn ("Adding Help Forum to:", dmz.stance.getDisplayName(group), dmz.object.superLinks(group, dmz.stance.HelpLink), !dmz.object.superLinks(group, dmz.stance.HelpLink));
      handle = dmz.object.create(dmz.stance.HelpForumType);
      dmz.object.text(handle, dmz.stance.NameHandle, dmz.stance.getDisplayName(group));
      dmz.object.activate(handle);
      dmz.object.link(dmz.stance.HelpLink, handle, group);
   });
});
