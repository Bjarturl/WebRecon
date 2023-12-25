import axios from 'axios';
import Bottleneck from 'bottleneck';
import { renderTQDM } from '../fomatting.js';

const defaultHeaders = {
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'accept-language': 'en-US,en',
    'cache-control': 'no-cache',
    pragma: 'no-cache',
    'sec-ch-ua': '" Not;A Brand";v="99", "Google Chrome";v="91", "Chromium";v="91"',
    'sec-ch-ua-mobile': '?0',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
};

export default class RequestGateway {
    completed = 0;
    errors = 0;
    scheduled = 0;

    scheduler = new Bottleneck({
        maxConcurrent: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 300,
    });

    async schedule(url) {
        this.scheduled += 1;
        return this.scheduler.schedule(async () => {
            const reqPromise = axios.get(url, {
                headers: {
                    ...defaultHeaders,
                    'Cookie': "PHPSESSID=76283c7f1e5d0833fc81161a6ccd857d; form_key=LSBRf4A9WS1SOeVL; mage-cache-storage={}; mage-cache-storage-section-invalidation={}; mage-messages=; recently_viewed_product={}; recently_viewed_product_previous={}; recently_compared_product={}; recently_compared_product_previous={}; product_data_storage={}; section_data_ids={%22company%22:1703009452%2C%22customer%22:1703009452%2C%22compare-products%22:1703009452%2C%22last-ordered-items%22:1703009452%2C%22requisition%22:1703009452%2C%22cart%22:1703009452%2C%22directory-data%22:1703009452%2C%22captcha%22:1703009452%2C%22wishlist%22:1703009452%2C%22company_authorization%22:1703009452%2C%22negotiable_quote%22:1703009452%2C%22instant-purchase%22:1703009452%2C%22loggedAsCustomer%22:1703009452%2C%22multiplewishlist%22:1703009452%2C%22purchase_order%22:1703009452%2C%22persistent%22:1703009452%2C%22review%22:1703009452%2C%22recently_viewed_product%22:1703009452%2C%22recently_compared_product%22:1703009452%2C%22product_data_storage%22:1703009452}; X-Magento-Vary=9e334fbd8c0b0c1e88e6b2df40ed21140ccf0caa; form_key=LSBRf4A9WS1SOeVL; mage-cache-sessid=true"
                }
            });
            const result = await reqPromise.catch(async (err) => {
                this.errors += 1;
                throw err;
            });
            this.completed += 1;
            renderTQDM(this.completed, this.scheduled, this.errors);
            return result;
        });
    }
}
