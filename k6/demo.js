import { sleep } from 'k6';
import {check,group} from 'k6';
import {randomIntBetween} from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import http from 'k6/http';
import {parseHTML} from 'k6/html';
import {Trend} from 'k6/metrics';
import {htmlReport} from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import {textSummary} from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

const baseUrl = 'https://reqres.in';

//Transaction Metrics
const createAPITrend = new Trend('POST_create_new_user__');
const listUserAPITrend = new Trend('GET_all_users__');
const updateAPITrend = new Trend('PUT_update_the_user__');
const getUserAPITrend = new Trend('GET_list_user__');
const deleteAPITrend = new Trend('DELETE_the_user__');

const MAX_RETRIES = 3;

const jobs = JSON.parse(open('test-data/job.json'));

export let options = {
    thresholds: {
        'http_req_duration': ['p(95)<2000'], // 99% of requests must complete below 2000ms
        'http_req_duration{status:201}': ['max>=0'],
        'http_req_duration{status:200}': ['max>=0'],
        'http_req_duration{status:400}': ['max>=0'],
        'http_req_duration{status:404}': ['max>=0'],
        'http_req_duration{status:500}': ['max>=0']
    },
    'summaryTrendStats': ['min', 'med', 'avg', 'p(90)', 'p(95)', 'max', 'count'],
};

export default function loggedUserFlow(data) {
    group('CRUD Operations ', (_) => {

        // Random function
        function getRandomInt(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        const randomInt = getRandomInt(1, 10000);        
        const name = "test user" + randomInt;
        console.log(name);

        const job = jobs[Math.floor(Math.random() * jobs.length)]
        /**
         * Step 1: Create new User
        */

        let createPayload = JSON.stringify({
            name: name,
            job: job
        });

        const create_response = sendRequest(
            `${baseUrl}/api/users`,
            createPayload,
            undefined,
            'post',
            200
        );
        createAPITrend.add(create_response.timings.duration);
        check(create_response, {
            'Create record response success  ': (r) => r.status === 201
        });
        let userId;
        userId = create_response.json().id;
        
        /**
         * Step 2: List all users
        */

        const listUser_response = sendRequest(
            `${baseUrl}/api/users?page=2`,
            undefined,
            undefined,
            'get',
            200
        );
        listUserAPITrend.add(listUser_response.timings.duration);
        check(listUser_response, {
            'List Users API response success  ': (r) => r.status === 200
        });

        /**
         * Step 3: Update the user
        */

        let updatePayload = JSON.stringify({
            name: name,
            job: job
        });

        const update_response = sendRequest(
            `${baseUrl}/api/users/${userId}`,
            updatePayload,
            undefined,
            'put',
            200
        );
        updateAPITrend.add(update_response.timings.duration);
        check(update_response, {
            'Update Users API response success  ': (r) => r.status === 200
        });

        /**
         * Step 4: Get User by ID
        */

        const getUser_response = sendRequest(
            `${baseUrl}/api/users/2`,
            undefined,
            undefined,
            'get',
            200
        );
        getUserAPITrend.add(getUser_response.timings.duration);
        check(getUser_response, {
            'Get the User by ID API response success  ': (r) => r.status === 200
        });

        /**
         * Step 5: Delete User 
        */

        const delete_response = sendRequest(
            `${baseUrl}/api/users/${userId}`,
            updatePayload,
            undefined,
            'delete',
            200
        );
        deleteAPITrend.add(delete_response.timings.duration);
        check(delete_response, {
            'Delete Users API response success  ': (r) => r.status === 204
        });

   });
}

function sendRequest(url, payload, params, method, expectedResponseCode, retries = MAX_RETRIES) {
    let response;
    for (let iteration = 0; iteration < retries; iteration++) {
        if (method === 'post') {
            response = http.post(url, payload, params);
        }
        else if (method === 'put') {
            response = http.put(url, payload, params);
        } 
        else if (method === 'get') {
            response = http.get(url, params);
        }
        else if (method === 'delete') {
            response = http.del(url, params);
        }
        if (response.status === expectedResponseCode) {
            return response;
        }
    }
    return response;
}

export function handleSummary(data) {
    return {
        'result.html': htmlReport(data),
        stdout: textSummary(data, {
            indent: ' ',
            enableColors: true
        }),
    };
}