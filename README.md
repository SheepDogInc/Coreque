# Coreque
### COde REview QUEue

# Mile High Summary

A simple way to claim pull request 'code reviews' as your own, and automate 
the inefficiency of finding relevant pull requests to review by sifting out
projects you're not interested in, as well as taking responsibility / 
assigning a review to yourself.

It's a Chrome extension with a web application backend that connects to the
GitHub API to pull in Pull Requests, and notify you via the chrome extension.
You can 'assign' yourself to a pull request via the app so others know that 
you're working on it, and the app can keep track of  additional data to do 
with the request.

The Chrome Extension should allow you to log into the app, and display a list
of unassigned pull requests. These are filtered on the web app settings side, 
where you can list projects that you're interested in or want to blacklist 
from showing in your list.

# Scratchpad

    - User lists projects that they're interested in
    - Chrome Ext lists pull requests that you can assign yourself to
    - Assigning you to it will display for all other users that you're doing it
    - When pull request marks as closed, it will sync to the app as well
    - Assign others to do code reviews
    - Chrome Ext should have a notification count for 'unread' pull requests 
that are actionable to you
    - All code reviewing still happens within GitHub
    - All data should be exportable and reportable 
        - potential game for quickest code reivew turnarounds
    - Uses new GitHub API v3 to fetch pull request data
    
# Contributing

Please make changes to this document, as we are still in problem definition mode!

