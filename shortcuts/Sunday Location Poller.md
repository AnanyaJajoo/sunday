# Sunday Location Poller

This is the exact iPhone Shortcut recipe for the backend polling flow.

It does not wait for a text message. Instead, it:
1. asks your Sunday backend if a location request is pending
2. exits immediately if there is no request
3. gets your current location
4. posts it back to the backend

Use your Tailscale hostname or Tailscale IP for the base URL.

Example base URL:
- `http://your-mac.tailnet-name.ts.net:8000`
- or `http://100.x.y.z:8000`

## Shortcut actions

1. `Text`
   Put your base URL here, for example:
   `http://your-mac.tailnet-name.ts.net:8000`

2. `Set Variable`
   Name: `BaseURL`

3. `Get Contents of URL`
   URL: `BaseURL` + `/api/location/request`
   Method: `GET`

4. `If`
   Condition: `Contents of URL` `has any value`

5. `Get Dictionary from Input`
   Input: `Contents of URL`

6. `Get Dictionary Value`
   Key: `request`
   Save as variable `Request`

7. `Get Dictionary Value`
   From: `Request`
   Key: `request_id`
   Save as `RequestID`

8. `Get Dictionary Value`
   From: `Request`
   Key: `token`
   Save as `Token`

9. `Get Dictionary Value`
   From: `Request`
   Key: `callback_url`
   Save as `CallbackURL`

10. `Get Current Location`

11. `Get Details of Location`
    Input: `Current Location`
    Detail: `Latitude`
    Save as `Latitude`

12. `Get Details of Location`
    Input: `Current Location`
    Detail: `Longitude`
    Save as `Longitude`

13. `Get Details of Location`
    Input: `Current Location`
    Detail: `Name`
    Save as `Address`

14. `Dictionary`
    Keys and values:
    - `request_id` -> `RequestID`
    - `token` -> `Token`
    - `lat` -> `Latitude`
    - `lng` -> `Longitude`
    - `address` -> `Address`

15. `Get Contents of URL`
    URL: `CallbackURL`
    Method: `POST`
    Request Body: `JSON`
    JSON: the dictionary from the previous step

16. `Otherwise`
    Do nothing

17. `End If`

## Notes

- If the backend returns `404`, that just means there is no pending location request right now.
- If your Shortcut throws on `404`, wrap the first `Get Contents of URL` in `Try` / `Otherwise` if your iOS version supports it, or use `Continue in Shortcuts App` and ignore the missing-request case.
- Tailscale is the cleanest way to make this work across your phone and Mac without exposing the endpoint publicly.
