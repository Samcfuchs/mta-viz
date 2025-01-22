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

