import './decent-head.config.js';
import { DecentHead } from './vendor/decent-head/2.0.0/js/main.js';
const storage = DecentHead.getIpfs();
const unavailable = async () => { throw new Error('NDA public upload, restore and replication are disabled. Keep agreements and keys local.'); };
storage.upload = unavailable;
storage.restore = unavailable;
storage.pin = unavailable;
export { DecentHead };
