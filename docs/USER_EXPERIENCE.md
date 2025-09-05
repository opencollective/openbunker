# Overview

The premise of this project being that many users are not familiar with NOSTR, we aim to make the amount of new concepts to learn and the departure from regular web application experience as minimal as possible.

All external applications will have to be configured with :

- a NOSTR bunker pubkey that corresponds to an Openbunker scope

## Unauthenticated Email secret token experience

This mode of functioning involves the user being able to not be authenticated in OpenBunker but still be able to connect to a bunker by verifying their email address. This way the user never leaves the client application.

- the user inputs their email address
- the application sends an HTTP request for a connection token/secret of 6 digits to Openbunker, along with a `scope`
- Openbunker sends an email to the email address for verification.
- Client application collects connection secret from the user and uses it as a secret in a `bunker://` connection token

## AuthUrl experience

In the client application:

- the user clicks a pre-configured Openbunker button to set up a connection. This attempts to connect to the bunker via NOSTR
- the web application attempts to connect and if it fails, opens a pop-up or redirects to Openbunker to make the user approve the connection
- upon approval the pop-up closes or redirect happens, then the client application shows a loading sign until the connection is established

This involves a pop-up or redirect, which is not the best for new users as they have to create their account.

## Basic BunkerUrl experience

- copy paste a bunker url and wait for connection in the client

This is the most burdensome as the user will need to already know about Openbunker, understand keys and create a key as well as copy paste it

## Integrated Bunker URL experience

- the user clicks an Openbunker button to set up a connection.
- opens a pop-up or redirects to Openbunker to make the user approve the connection. The user approves sharing the key and returns a bunkerConnectionToken
- the bunker connection is set up
  This works a bit like the AuthUrl, except that we do not attempt a NIP-46 connection first and get the info about where to go to approve our session, so it requires a bit more web2 configuration and logic to handle redirect and popup responses

## Integrated nostrconnect URL experience

- the client application communicates a nostrconnect token to Openbunker via a pop-up or redirect.
- the client application responds with a connect response

## Email nostrconnect experience

- the client application communicates a nostrconnect token to Openbunker via an API
- the user needs to check their email and approve it
