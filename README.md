# MTA Live Data Visualization

![`A screenshot of the app`](image.png)

This app provides a 3-D interactive view of the live state of the NYC
subway system, as data is provided through the MTA GTFS-RT API. Train
positions are interpolated from the most recent data, as a "best guess"
based on the train's anticipated arrival time at its next station.
Although this is inexact, it is *no less* accurate than the information
the MTA itself has on the tracks that have not implemented CBTC
(Communications-Based Train Control). To my knowledge, CBTC data from
the routes that have implemented it (the L and 7 lines) is not yet
available through a real-time API. You can read more about the MTA's
CBTC rollout [here](https://new.mta.info/project/cbtc-signal-upgrades).

## Setup

There's a [Dockerfile](./Dockerfile) now, so setting this up is actually quite
easy. I'm working on a deployment to get this live using the docker image. Stay
tuned. Meanwhile, run it yourself like so:

```bash
docker build -t mta .
docker run -p 3000:3000 mta
```

The site will be live at http://localhost:3000. For a non-containerized
instance, run this instead:

```bash
npm install
mkdir -p ./data/rt
curl -L -o ./data/gtfs_subway.zip https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip
unzip ./data/gtfs_subway.zip -d ./data/gtfs_subway
npm run build:server
npm run run:server

node dist/RealTime.js
```

## Future Work

- [ ] Live deploy: Deploy the server onto a public device to get this live for
  viewing.
- [ ] Map overlay: Get 2D or 3D file from openstreetmap, google earth, or
  similar to add context.
- [ ] Better tooltips: current tooltips are designed mostly for debugging
  purposes. Streamline these and format information in a more useful way.
- [ ] Add details pane: provide more information about each train in a vertical
  pane.
- [ ] Improve train interpolation: Fit train positions to the curves of their
  tracks and match their orientations as well.
- [ ] Stop data: Add detailed interactivity for stations
    - [ ] Add hover and click functions to view stop details
    - [ ] Label stops with their actual names rather than IDs
    - [ ] Graphically represent conjoined stations with multiple stops
- [x] Improve train matching between data refreshes: sometimes trains are not
  correctly matched between realtime data sets and they seem to jump between
  locations.
  - [x] Interpolate between updates: Trains that are correctly matched but
    receive a "drastic" update should accelerate toward their new location, but
    should not snap from place to place.
- [ ] Continuous turning: Trains currently don't animate orientation changes,
  they simply snap to the new direction they'll point toward. Smooth this out.
- [ ] Separate data updates from the animation loop: While the data fetch is
  appropriately separate from animations, the actual loading of the data into
  individual trains is not, so there is a brief hitch in the animations every 30
  seconds. Separate this data further so that it doesn't impact the UX.
- [ ] Default animation loop: Add a default camera motion for nicer
  "screensaver" behavior.
- [ ] Fix a bug: There is still one bug which interrupts updates occasionally.
  Investigate this.
