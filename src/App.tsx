import { useEffect, useState } from 'react'
import './App.css'

import GtfsRealtimeBindings from "gtfs-realtime-bindings"

/*
function test() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}
*/

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

function App() {
  const [data, setData] = useState(null)
  useEffect(() => {
      fetch(BDFM_API, {headers: {'x-api-key': API_KEY}})
        .then(handleResponse)
        .then(setData)
      .catch(error => {
        console.error(error)
      });


    return () => { console.log("Done"); }

  }, []);

  if (!data) return <p>No data available</p>

  return (
    <>
    <div>
      <h1>Data response:</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
    </>
  )
}

export default App
