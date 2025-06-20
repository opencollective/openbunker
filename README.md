# openbunker
Bunker to onboard members of your community to Nostr

## Context

We want to use Nostr as a backend for the new open collective but most people don't know how to properly manage a private key. 
Like Coinbase did for Bitcoin, we want to offer a custodial way for people to have a private key, a Nostr profile and contribute to their collective.

This bunker should work with an email address or discord user.
We send them a 6 digit code valid for 5 minutes to confirm their identity.

One of the key feature is to allow our backend to sign on behalf of a user so that they can interact with the platform via a Discord bot (or when they submit a payment via Stripe, we can also automatically add a new event "User has paid the invoice #xyz123".

