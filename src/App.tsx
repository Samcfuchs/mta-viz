import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three';
import './App.css'
import {Map} from './Viz.tsx'

import {Cube, Lines} from './demo.tsx'

import GtfsRealtimeBindings from "gtfs-realtime-bindings"

const BDFM_API = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm'
const API_KEY = ''

async function handleResponse(response:Response) : Promise<any> {
  if (!response.ok) {
    const error = new Error(`${response.url}: ${response.status} ${response.statusText}`);
    //error.response = response;
    throw error;
    process.exit(1);
  }
  const buffer = await response.arrayBuffer();
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer))
  let data : any = []
  feed.entity.forEach(entity => {
    if (entity.tripUpdate) {
      data.push(entity)
      console.log(entity)
    }
  });

  return data;


}

let fetch_url = 'http://localhost:3000/stops'

function App() {
  const [data, setData] = useState(null)
  useEffect(() => {
    /*
      fetch(fetch_url, {headers: {'x-api-key': API_KEY}})
        .then(response => response.json())
        .then(setData)
      .catch(error => {
        console.error(error)
      });
    */


    return () => {}

  }, []);

  //if (!data) return <p>No data available</p>

  return (
    <>
    <Map />
    {/* <Cube /> */}
    {/* <Lines /> */}
    </>
  )
}


export default App
