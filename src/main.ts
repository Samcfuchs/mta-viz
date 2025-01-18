import './App.css'
import {init, update as viz_update} from './Viz.ts'
import {pull,init as init_data} from './RealTime.ts';

init()
init_data()

window.setInterval(() => {
    let d = pull();
    if (d && d.length) viz_update(pull())
}, 1000);
console.info("test")