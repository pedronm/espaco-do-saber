# Introduction
We've being doing a implementation that follows a principle of live streaming application within the following context


### Scope ✅️
Work with multiple roles that access a Portal that presents the user within certain functionalities accordingly to its role, and the objective of it is to show livestreams to users, as well, as have those stored and being accessible accordingly to specified users.

- 🚧 Live streams 

   Those are started through OBS, being activated for the users, in case they have permission , to watch by the platform. And the resulting video is stored in minio server, so the users can access it later 

- 🚧 Stored Videos
  
   A logic close to the one before, but the only the admin and the teacher can add videos to the platform, and determine wich role can see them.

- 🚧 User management
  
  The user can register itself at the main page, but only when an admin or teacher let'em in that they can access the platform. So there's user management for admin and teacher in the platform, as also, the user will be notified through mail! The SMPT configuration will be defined postly.


And that is what the architecture of this project is about!

### What theres now? 🚫
Now the idea thats constructed is, the teacher and admin can start lives through the platform, oposing its simplier purpose, of being a medium for OBS operations. 

It has a lot of logic in the frontend, a lot of endpoints not used properly, lack of granularity in both parts and heavier to use.

The auth is only settled in the backend(spring) part and that reduce the effectivenes of the other modules like python wich process videos and go wich sustain the streams


❌ Out of the format it was suposed to have

❌ Over complexity

❌ Low granularity

❌ Much modules that aren't free to communicate

🙅 Doesn't attend to what it is suposed to do!


### Step 1 Cleaning

Before start working it need to have some cleaning!

#### First we work at frontend
Remove what won't be necessary anymore! Theres no need to use stream lives from the portal now, so everything related to it, even the services for it are unnecessary, e.g.: 
live-stream-list.component

The video player needs some change as it won't be working with hls anymore, but with rtmp from OBS comm

#### Secondly we'll be changing the backend
Remove the excess of endpoints, principally the streaming ones, and mostly important ANY stream related! The backend now is just for storing data onto the DB and also authenticating!

#### Third ! Clean GOlang proj
The vide-streaming project went through a lot of stuff! But now it just needs rtmp to work with OBS. So just the rmtp server

### Step 2 - Now that everything is clean we can start working!

#### At the frontend
Now the page wich shows the streams needs to connect directly to the GOlang proj server! It'll be showing what obs is recording!

Now the Videos" page need some refactoring to it, so it can work properly with the new arch! Still we'll be sending to python work on it!

Thats one of the biggest changes, we need to keep sending the auth obj to everyone BackEnd(store stuff on db), Python(process videos), Go work with streams! 

** Admin page needs an component that show endpoint for obs to be connected

#### At the backend
Now he only is responsible for auth, and for saving every interaction into the database! SO its endpoints adequated properly for consumption

We need a refresh token so when the user is watching streams it kept him connected

#### At the processing members

Here are the biggst changes, now that, they will validate the auth token so they know that the person request is authorized!

And also, GOlang projct video-streaming is a rtmp server for OBS wich will be working parallel expecting at its endpoint wich will be provided through admin page for the admin user or teacher.

The last and missing attribute of this part is that go needs to store the stream when it ends at the minio server just as python uses it to stores the videos

#### At the infraestructure(IAC)
That just needs to enhance reliability ! There'll be no further changes, since, they all could communicate before.