import * as THREE from 'three';

export type TrainProps = {
    tripId: string | undefined,
    parentStop : string | undefined,
    status: number | undefined,
    routeId: string | undefined | null,
    direction: string | undefined
};

export class Train {
    mesh : THREE.Mesh;
    props : TrainProps;

    static SIZE : number = .002

    constructor(p : TrainProps) {
        this.mesh = this.create_mesh();
        this.props = p;
    }

    

    create_mesh() : THREE.Mesh {
        //let geometry = new THREE.BoxGeometry(Train.SIZE, Train.SIZE, Train.SIZE)
        //console.log("Making mesh");
        let geometry = new THREE.ConeGeometry(.001, .002);

        geometry.lookAt(new THREE.Vector3(0,0,-1));
        let material = new THREE.MeshNormalMaterial();
        let obj = new THREE.Mesh(geometry, material);

        return obj;
    }

    set_pos(v:THREE.Vector3) {
        //let rand = new THREE.Vector3().randomDirection()
        //let vec = v.addScaledVector(rand, .0005);
        let vec = v;
        this.mesh.position.set(...vec.toArray());
        //this.mesh.lookAt(new THREE.Vector3(0,100,0))
    }

    set_heading(deg : number) {
        let rads = -(deg % 360) * (Math.PI * 2 / 360) ;
        let y = Math.sin(rads);
        let x = Math.cos(rads);

        this.mesh.setRotationFromAxisAngle(new THREE.Vector3(0,0,1), rads)
    }

    add_to_scene(s : THREE.Scene) {
        s.add(this.mesh);
    }

    update(ms : number) {
        console.log("updating")
        //this.mesh.rotateZ(Math.sin(ms/100)*.1)
        this.set_heading(180);
    }
}

export default Train;