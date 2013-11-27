( function() {

"use strict"

var GE = Gibber.Environment, Chat;

Chat = window.Chat = Gibber.Environment.Chat = {
  socket : null,
  lobbyElement: null,
  roomElement: null,
  currentRoom: 'lobby',
  open : function() {
    if( GE.Account.nick === null ) {
      GE.Message.post( 'You must log in before chatting. Click the link in the upper right corner of the window to login (and create an account if necessary).' )
      return
    }
    this.column = Layout.addColumn({ header:'Chat' })
    this.column.onclose = function() {
      this.socket.close()
    }
    // this.column.header.append( $( '<span>lobby</span>') )
    this.lobbyRoom = $( '<div>' ).css({ display:'inline', marginLeft:'2em' })
    
    this.lobby = $( '<button>' )
      .text( 'lobby' )
      .on( 'click', function() { Chat.moveToLobby() } )

    this.room =  $( '<button>' )
      .text( 'room' )
      .on( 'click', function() { Chat.moveToRoom( 'test' ) } )

    this.addButton = $('<button>' )
      .text( 'create room' )
      .on( 'click', Chat.createRoom )
      .css({right:0 })

    this.lobbyRoom.append( this.lobby, this.room, this.addButton )

    this.column.header.append( this.lobbyRoom )
    $script( 'external/socket.io.min', function() {
      console.log( 'SOCKET IO LOADED' )
      Chat.socket = io.connect('http://gibber.mat.ucsb.edu');

      // this.socket = new WebSocket( socketString );

      Chat.socket.on( 'message', function( data ) {
        data = JSON.parse( data )
        // console.log( data )
        if( data.msg ) {
          if( Chat.handlers[ data.msg ] ) {
            Chat.handlers[ data.msg ]( data )
          }else{
            console.error( 'Cannot process message ' + data.msg + ' from server' )
          }
        }
      })
      
      Chat.socket.on( 'connect', function() {
        console.log( "CONNECTION SUCCESSFUL" )
        Chat.moveToLobby()
        Chat.socket.send( JSON.stringify({ cmd:'register', nick:GE.Account.nick }) )
      })
    })
  },

  moveToLobby : function () {
    if( this.lobbyElement === null ) {
      this.lobbyElement = $( '<div>' ).addClass( 'chatlobby' )
      this.column.element.append( this.lobbyElement )
    }else{
      this.lobbyElement.empty()
      this.lobbyElement.show()
      this.column.bodyElement = this.lobbyElement

      if( this.roomElement !== null ) this.roomElement.hide()
    }

    GE.Layout.setColumnBodyHeight( this.column )
    this.lobby.css({ color:'#333', background:'#ccc' })

    if( this.currentRoom !== 'lobby' ) {
      this.socket.send( JSON.stringify({ cmd:'leaveRoom', room:this.currentRoom }) ) 
    }

    this.currentRoom = 'lobby'
    this.room.css({ color:'#ccc', background:'#333' })
    this.room.hide()
    this.addButton.show()
    
    this.socket.send( JSON.stringify({ cmd:'listRooms' }) )
  },

  moveToRoom : function( roomName ) {
    if( this.currentRoom === 'lobby' ) {
      this.lobbyElement.hide()
      this.lobby.css({ color:'#ccc', background:'#333' })
    }
    this.room.show()
    this.addButton.hide()

    if( this.roomElement === null ) {
      this.roomElement = $( '<div>' ).addClass( 'chatroom' )
      this.messages = $( '<ul>')
        .css({
          display:'block',
          height:'calc(100% - 5em - ' +this.column.header.outerHeight()+ 'px)',
          width: 'calc(100% - 1em - ' + GE.Layout.resizeHandleSize +'px)',
          margin:0,
          padding:'.5em',
          'box-sizing':'border-box !important',
          'overflow-y':'auto',
        })
      this.msgPrompt = $( '<span>' )
        .text( 'enter msg : ' )
        .css({
          left:0,
          bottom:0,
          position:'absolute',
          display:'inline-block',
          width:'6em',
          height:'5em',
          lineHeight:'5em',
          background:'#191919',
          color:'#ccc',
          paddingLeft:'.5em',
        })
      
      this.msgField = $( '<textarea>' ).css({
        position:'absolute',
        left:'6em',
        bottom:0,
        height: '5em',
        verticalAlign: 'center',
        width:'calc(100% - 6em - ' + GE.Layout.resizeHandleSize +'px )', 
        background:'#aaa',
        color:'#333',
        fontSize:'1em',
      })
      .keydown(function(event) {
        if (event.keyCode == 13) {
          Chat.socket.send( JSON.stringify({ cmd:'message', text:this.value, user:GE.Account.nick }) )
          this.value = ''
          event.preventDefault() 
        }
      })

      this.roomElement.append( this.messages, this.msgPrompt, this.msgField )
      this.column.element.append( this.roomElement )
    }else{
      this.roomElement.find('ul').empty()
      this.roomElement.show()
      if( this.lobbyElement !== null ) this.lobbyElement.hide()
    }
    this.column.bodyElement = this.roomElement
    GE.Layout.setColumnBodyHeight( this.column )
    this.room
      .css({ color:'#333', background:'#ccc' })
      .text( roomName )

    this.currentRoom = roomName
  },
  
  createRoom : function() {
    var name = window.prompt( "Enter a name for the chatroom." ),
        msg  = {}

    msg.name = name
    msg.password = null
    msg.cmd = 'createRoom'
    Chat.socket.send( JSON.stringify( msg ) )
  },
  handlers : {
    messageSent : function( data ) {
      /* msg sent successfully, do nothing for now */
    },
    registered : function( data ) {
      /* successfully registered nick, do nothing for now */
    },
    listRooms : function( data ) {
      var roomList = $( '<ul>' ).css({ paddingLeft:'1em' })
      for( var key in data.rooms ) {
        var msg = JSON.stringify( { cmd:'joinRoom', room:key } ),
            lock = data.rooms[ key ].password ? " - password required" : " - open",
            link = $( '<span>').text( key + "  " + lock )
              .on( 'click', function() { Chat.socket.send( msg ) } )
              .css({ pointer:'hand' }),
            li = $( '<li>').append( link )
            
        roomList.append( li )
      }
      Chat.lobbyElement.append( roomList )
    },
    incomingMessage: function( data ) {
      var name = $( '<span>' )
            .text( data.nick )
            .addClass( (GE.Account.nick === data.nick ? 'messageFromSelf' : 'messageFromOther' ))
            .on( 'click', function() {
              GE.Share.promptToShareWith( data.nick )
            })
            .css({ cursor:'pointer' }),
          li = $( '<li class="message">' )
            .text(  " : " +  data.incomingMessage )

      li.prepend( name )
      Chat.messages.append( li )
      $( Chat.messages ).prop( 'scrollTop', Chat.messages.prop('scrollHeight') )
    },
    roomCreated: function( data ) { // response for when the user creates a room...

    },
    roomAdded : function( data ) { // response for when any user creates a room...
      if( Chat.currentRoom === 'lobby' ) { 
        Chat.lobbyElement.empty()
        console.log( 'ROOM ADDED AND LIST RE-LOADED' )
        Chat.socket.send( JSON.stringify({ cmd:'listRooms' }) )
      }
    },
    roomDeleted : function( data ) {
      if( Chat.currentRoom === 'lobby' ) { 
        Chat.lobbyElement.empty()
        console.log( 'ROOM REMOVED AND LIST LOADED ' )
        Chat.socket.send( JSON.stringify({ cmd:'listRooms' }) )
      }
    },
    roomJoined: function( data ) {
      Chat.moveToRoom( data.roomJoined )
    },
    collaborationRequest: function( data ) {
      var div = $('<div>'),
          msg = null,
          h3  = $('<h3>').text( data.from + ' would like to collaboratively edit code with you. Do you accept?' ),
          radioY = $('<input type="radio" name="yesorno" value="Yes">Yes</input>'),
          radioN = $('<input type="radio" name="yesorno" value="No">No</input>'),
          submit = $('<button>')
            .text('submit')
            .on( 'click', function() {
              var val =  $('input[type=radio]:checked').val()
              Chat.socket.send( JSON.stringify({ cmd:'collaborationResponse', response:val==='Yes', to:data.from }) )
              msg.remove()
            })

      div.append(h3, radioY, radioN, submit )

      msg =  GE.Message.postHTML( div )
    },
    collaborationResponse: function( data ) {
      GE.Share.collaborationResponse({ from: data.from, response: data.response })
    },
    shareReady : function( data ) {
      var column = GE.Layout.addColumn({ type:'code' })

      GE.Share.openExistingDoc( data.shareName, column )
    },
  },
}

})()