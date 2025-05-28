import './App.css'
import {initScene, setData, initDataTracks} from './Viz.ts'
//import {pull, init} from './RealTime.ts';

initScene();
//await initData()
await initDataTracks();

const REALTIME_URL = 'http://localhost:3000/realtime'


//init().then(() => {
async function fetchData() {
    try {
        //const d = await fetch(DATA_SERVER + '/realtime')
        //const d = pull();
        
        const data = await fetch(REALTIME_URL).then(response => {
            if (!response.ok) throw new Error("Fetching realtime data failed");
            return response.json();
        })

        console.debug("data loaded:", data);

        //console.debug('rtd loaded:', d);
        if (data) setData(data);
    } catch (error) {
        console.error("Error fetching data:", error)
    } finally {
        setTimeout(fetchData, 30 * 1000)
    }
};

fetchData();

//});
