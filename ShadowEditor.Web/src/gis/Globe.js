import Renderers from './render/Renderers';
import OrbitViewer from './view/OrbitViewer';
import GeoUtils from './utils/GeoUtils';

import GoogleTiledLayer from './layer/tiled/image/GoogleTiledLayer';
import TiandituTiledLayer from './layer/tiled/image/TiandituTiledLayer';
import BingTiledLayer from './layer/tiled/image/BingTiledLayer';
import WGS84 from './core/WGS84';

/**
 * 地球
 * @author tengge / https://github.com/tengge1
 * @param {THREE.PerspectiveCamera} camera 相机
 * @param {THREE.WebGLRenderer} renderer 渲染器
 * @param {Object} options 配置
 * @param {String} options.server 服务端配置
 * @param {Boolean} options.useCameraPosition 是否使用相机位置
 * @param {Number} options.maxThread 最大工作线程数，避免任务创建过多，导致地图卡顿
 */
function Globe(camera, renderer, options = {}) {
    THREE.Object3D.call(this);

    options.server = options.server || location.origin;
    options.useCameraPosition = options.useCameraPosition || false;
    options.maxThread = options.maxThread || 10;

    this.name = L_GLOBE;

    Object.assign(this.userData, {
        type: 'Globe',
        background: 'google',
    });

    this.camera = camera;
    this.renderer = renderer;
    this.options = options;

    this.thread = 0; // 当前线程总数
    this.matrixAutoUpdate = false;

    this.time = new Date();
    this.timeZone = this.time.getTimezoneOffset() / 60; // minutes
    this.sunPosition = new THREE.Vector3();

    // 不能命名为layers，否则跟three.js的layers冲突
    this._layers = [
        new GoogleTiledLayer(this),
        //new TiandituTiledLayer(this),
        // new BingTiledLayer(this),
    ];

    this.renderers = new Renderers(this);
    this.viewer = new OrbitViewer(this.camera, this.renderer.domElement);

    // 如果不使用相机位置，则设置默认中心点
    if (!this.options.useCameraPosition) {
        this.viewer.setPosition(0, 0, GeoUtils.zoomToAlt(2));
    }
}

Globe.prototype = Object.create(THREE.Object3D.prototype);
Globe.prototype.constructor = Globe;

/**
 * 设置背景
 * @param {*} type 背景类型，支持google、tianditu、bing
 */
Globe.prototype.setBackground = function (type) {
    var newLayerName = 'google';

    switch (type) {
        case 'bing':
            newLayerName = 'bing';
            break;
        case 'tianditu':
            newLayerName = 'tianditu';
            break;
        default:
            newLayerName = 'google';
            break;
    }

    var layer = this._layers[0];

    if (newLayerName === layer.name) {
        return;
    }

    this.userData.background = newLayerName;

    var newLayer = null;

    switch (newLayerName) {
        case 'google':
            newLayer = new GoogleTiledLayer(this);
            break;
        case 'tianditu':
            newLayer = new TiandituTiledLayer(this);
            break;
        case 'bing':
            newLayer = new BingTiledLayer(this);
            break;
    }

    this._layers[0] = newLayer;
    layer.dispose();
};

Globe.prototype.getBackground = function () {
    var layer = this._layers[0];
    return layer.name;
};

/**
 * 需要由应用程序连续调用
 */
Globe.prototype.update = function () {
    this.time = new Date();

    var hour = this.time.getHours() + this.timeZone;

    var angle = Math.PI * 2 / 24 * hour;
    var x = -WGS84.a * 10 * Math.cos(angle);
    var z = WGS84.a * 10 * Math.sin(angle);

    this.sunPosition.set(x, 0, z);

    this.renderers.render();
    this.viewer.update();
};

/**
 * 光线投射
 * @param {*} raycaster 
 * @param {*} intersects 
 */
Globe.prototype.raycast = function () {
    var geometry = new THREE.SphereBufferGeometry(WGS84.a, 32, 32);
    var material = new THREE.MeshBasicMaterial();
    var mesh = new THREE.Mesh(geometry, material);

    return function (raycaster, intersects) {
        return mesh.raycast(raycaster, intersects);
    };
}();

/**
 * 释放占用的所有资源
 */
Globe.prototype.dispose = function () {
    this.renderers.dispose();
    this.viewer.dispose();

    this._layers.forEach(n => {
        n.dispose();
    });

    delete this._layers;
    delete this.renderers;
    delete this.viewer;

    delete this.camera;
    delete this.renderer;
};

export default Globe;