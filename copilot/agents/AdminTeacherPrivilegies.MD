
## Introduction

 The 'Espaco do Saber' is all about providing users withing videos that are stored, wich will be retrieved accordingly to their permissions!  

 Also the only who should store or edit any saved video, that would be teacher or admin!

## Scope

  So to attend this scenario that has been spoken of in the intrduction there are the what is needed to be done and what needs to be enhanced!

  First of all, to guarantee the platform can and will lend user management screen for Admin and Teacher, as for the admin, he can and must be able to edit teachers, but, the teacher, will only edit students.

  As for subscribing! Anyone that can get to the firstt page of the portal(login) can register at the register form. But at the form he must specify what kinda of acces it its, "public" or "student" but in portuguese "Publico" ou "Aluno"

  #### one of the base rules of the project is that every user that has registered at the register screen will only be admited by the admin account, so the admin can admit new users, only him!

  The Scren that upload videos, needs to have a simplier interface, like, add video, and limit the acces, for example, the teacher will upload a video and need to decise between only for "students" or public. Public being its for everyone, and the student only, only for students! 
  **That same Work must also be done for the live streams! That why the InternalStreamEventsController, only for teachers and admins, so before the list of stream is set it'll generate a item in the list of admin and teacher for them to name the live, and then, accept it on the portal!

  After that is done, it'll determine wich person is able to watch it and if after its saved who it'll be available to watch.
  
  The following is missing:

    1. Manage Users
    2. Manage Lives streams
    3. Manage Videos
    4. Simpler video upload interface
    5. More control access when accessing the page, does the user has access for that page?
    6. Translate for portuguese
    7. Register form enhanced and with type of register combobox
    8. Admin only capability to accept or deny registrations on the system
    9. [EXTRA] Notify the user through email that they are now able to access the system
    10.[Extra] Notify the users that new content is available 

### Key Objectives

  1. Manage Users
  2. Manage Lives streams
  3. Manage Videos

### Requisites
  As of now, there are some visual parts that are still on english, all of the system must be in portuguese without exception! Its only for an audience that speaks brazillian portuguese 

  Try and simplificate the code, if something is used repeatedly will respect DRY, if something has far off the SOLID principles, that need correction too

### What not to do
1. Generate too many code.
2. Overcomplexity into the project
3. Lack of granularity
4. Overarchitecture for such simple solution

### What you can help with
If you can find or at your data, theres a better lib to use for that, you're free to do so, as long, as you show this solution to me.

### Troubleshoot

  As of now, when attempting to watch a stored livestream, theres some codec error, mostly cause of the type of video for the actual video player.

  i've been through some research and it seems there are better players for that, maybe its not the player, and trully the fact thats not streaming anymore, so its more a param refereing to the ways its consumpted, maybe the url should be changed to pointing to a file, not rtmp!


### Lib reference 

Video Player:
https://www.npmjs.com/package/videojs-flvjs

