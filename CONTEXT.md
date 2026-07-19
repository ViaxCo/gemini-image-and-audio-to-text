# Gemini Media Transcription

This context describes how image and audio transcription requests choose Gemini credentials and models.

## Language

**Saved API key**:
The single browser-stored Gemini credential available to requests. An unsaved key is only a draft and cannot be used.
_Avoid_: Active key, current key

**Selected model**:
The general-purpose Gemini model chosen for requests that have not started. A request reads this selection when its API call begins.
_Avoid_: Stored model, request model

**Request**:
One Gemini API call, including an initial submission, retry, or batch subrequest. Changing configuration does not alter a request that has already started.
_Avoid_: Job, card
