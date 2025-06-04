import './App.css'
import {initScene, setData, initDataTracks} from './Viz'
//import {pull, init} from './RealTime.ts';

initScene();
//await initData()

const REALTIME_URL = 'http://localhost:3000/data/realtime'


//init().then(() => {
async function fetchData() {
    try {

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

initDataTracks().then( fetchData );

//});
