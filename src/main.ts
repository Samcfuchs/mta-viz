import './App.css'
import {initScene, initData, setData} from './Viz.ts'
import {pull, init} from './RealTime.ts';

initScene();
initData();
init().then(() => {
    window.setInterval(() => {
        let d = pull();
        console.info('rtd loaded:')
        console.info(d)
        if (d) setData(d);
    }, 30*1000);
});