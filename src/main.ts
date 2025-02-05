import './App.css'
import {initScene, initData, setData, initDataTracks} from './Viz.ts'
import {pull, init} from './RealTime.ts';

initScene();
//await initData()
await initDataTracks();


init().then(() => {
    (async function fetchData() {
        try {
            const d = await pull();
            console.info('rtd loaded:', d)
            if (d) setData(d);
        } catch (error) {
            console.error("Error fetching data:", error)
        } finally {
            setTimeout(fetchData, 30 * 1000)
        }
    })();
});
