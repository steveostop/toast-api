/**
 * Toast module -
 * this module handles interaction with the Toast API 
 * 
 * @module Toast
 */

const axios = require('axios');
const rateLimiter = require('axios-rate-limit');

const configuration = require('./api/configuration/configuration');
const orders = require('./api/orders/orders');
const menuV2 = require('./api/menus/menuV2');
const timeEntries = require('./api/labor/timeEntries');
const employees = require('./api/labor/employees');
const jobs = require('./api/labor/jobs');
const shifts = require('./api/labor/shifts');

/**
 * Constructor for ToastAPI class
 * @param {string} [clientId] - Optional. Client ID for Toast API access. Defaults to process.env.TOAST_CLIENTID.
 * @param {string} [clientSecret] - Optional. Client secret for Toast API access. Defaults to process.env.TOAST_CLIENTSECRET.
 */
function ToastAPI(clientId, clientSecret) {
    this._clientId = clientId || process.env.TOAST_CLIENTID;
    this._clientSecret = clientSecret || process.env.TOAST_CLIENTSECRET;
    this._accessType = 'TOAST_MACHINE_CLIENT';
    this._accessToken = null;
    this._tokenExpires = Date.now();
    
    this._axios = rateLimiter(axios.create({
        baseURL: 'https://ws-api.toasttab.com'
    }), { maxRPS: 5 });

    this._getAccessToken = async function() {
        if (!this._accessToken || Date.now() > this._tokenExpires) {
            const res = await this._axios.post(
                '/authentication/v1/authentication/login', 
                {
                    clientId: this._clientId,
                    clientSecret: this._clientSecret,
                    userAccessType: this._accessType
                }
            ).catch(e => { throw e.response.data })
            this._tokenExpires = Date.now() + (res.data.token.expiresIn * 1000);
            this._accessToken = res.data.token.accessToken;
            console.log('expires in', res.data.token.expiresIn, this._tokenExpires)
        }
    }

    this._parseLink = function(linkHeader) {
        if (!linkHeader) return;
        const linkArray = linkHeader.split(/,\s?|;\s?rel=/g);
        const linkObj = {};
        for (let i = 0; i < linkArray.length; i+=2) {
            linkObj[linkArray[i+1].replace(/\"/g,'')] = linkArray[i].replace(/<|>/g, '');
        }
        return linkObj;
    }

    // get token on object instantion
    this._getAccessToken();
}

/**
 * Get revenue centers
 * @param {string} storeGUID - The Toast platform GUID of the restaurant that is the context for this operation.
 * @param {string} [guid] - Optional. The Toast POS GUID of a single revenue center to return.
 * @returns {Object} Object of RevenueCenter objects where keys are revenue center guids
 */
ToastAPI.prototype.getAllRevenueCenters = configuration.getAllRevenueCenters;

/**
 * Get tables
 * @param {string} storeGUID - The Toast platform GUID of the restaurant that is the context for this operation.
 * @returns {Object} Object where keys are toast guids
 */
ToastAPI.prototype.getAllTables = configuration.getAllTables;

/**
 * Get dining options
 * @param {string} storeGUID - The Toast POS GUID of the restaurant that the configuration applies to.
 * @returns {Object} Object where keys are toast guids
 */
ToastAPI.prototype.getAllDiningOptions = configuration.getAllDiningOptions;

/**
 * Get void reasons
 * @param {string} storeGUID - The Toast POS GUID of the restaurant that the configuration applies to.
 * @returns {Object} Object where keys are toast guids
 */
ToastAPI.prototype.getAllVoidReasons = configuration.getAllVoidReasons;

/**
 * Get multiple orders
 * Get the orders for either a specific period of time or for one business day.
 *  - specify both startDate and endDate to return the orders modified during that period of time.
 *  - specify the businessDate to return the orders promised during that business day.
 * @param {string} storeGUID - The Toast platform GUID of the restaurant that is the context for this operation.
 * @param {Date} startTime - business date or start of time period 
 * @param {Date} [endTime] - Optional. End of time period.
 * @returns {Object[]} Array of Order objects containing detailed information about all of the orders opened during a period of time
 */
ToastAPI.prototype.getAllOrders = orders.getAllOrders;

/**
 * Get multiple orders. Generator function, yeilds 1 page of results at a time.
 * Get the orders for either a specific period of time or for one business day.
 *  - specify both startDate and endDate to return the orders modified during that period of time.
 *  - specify the businessDate to return the orders promised during that business day.
 * @param {string} storeGUID - The Toast platform GUID of the restaurant that is the context for this operation.
 * @param {Date} startTime - business date or start of time period 
 * @param {Date} [endTime] - Optional. End of time period.
 * @yeilds {Object[]} Array of Order objects containing detailed information about all of the orders opened during a period of time
 */
ToastAPI.prototype.getOrders = orders.getOrders;

/**
 * Retrieves detailed information about a single order, specified by its GUID
 * @param {string} storeGUID - The Toast platform GUID of the restaurant that is the context for this operation.
 * @param {string} orderGUID - The Toast POS GUID of the for the order to be returned.
 * @returns {Object} Order object
 */
ToastAPI.prototype.getOrder = orders.getOrder;

/**
 * Get a store's menus.
 * @param {string} storeGUID - The Toast platform GUID of the restaurant that is the context for this operation.
 * @returns {Object} - Object representing the store's menu
 */
ToastAPI.prototype.getMenus = menuV2.getMenus;

/**
 * Get menu last modified timestamp
 * @param {string} storeGUID - The Toast platform GUID of the restaurant that is the context for this operation.
 * @returns {Object} - Object representing the store's menu
 */
ToastAPI.prototype.getMenus = menuV2.getMenuTimestamp;


/*************************************************************************************************/
/*** LABOR ***************************************************************************************/
/*************************************************************************************************/

/**
 * Get time entries
 * Get the time entries for either a specific period of time or for one business day.
 *  - include both a startTime and an endTime parameter to get time entries for a specific time period.
 *  - include a businessDate parameter to get the time entries with an inDate during a specific business date.
 * @param {string} storeGUID - The Toast platform GUID of the restaurant that is the context for this operation.
 * @param {Date} startTime - start of time period or businessDate.
 * @param {Date} [endTime] - Optional. End of time period.
 * @returns {Object[]} Array of TimeEntry objects that contain information about employee shift events. The information includes shift start times, end times, and the start and end times of break periods.
 */
ToastAPI.prototype.getAllTimeEntries = timeEntries.getAllTimeEntries;

/**
 * Get time entries. Generator function, yeilds 1 page of results at a time.
 * Get the time entries for either a specific period of time or for one business day.
 *  - include both a startTime and an endTime parameter to get time entries for a specific time period.
 *  - include a businessDate parameter to get the time entries with an inDate during a specific business date.
 * @param {string} storeGUID - The Toast platform GUID of the restaurant that is the context for this operation.
 * @param {Date} startTime - start of time period or businessDate.
 * @param {Date} [endTime] - Optional. End of time period.
 * @yields {Object[]} Array of TimeEntry objects that contain information about employee shift events. The information includes shift start times, end times, and the start and end times of break periods.
 */
ToastAPI.prototype.getTimeEntries = timeEntries.getTimeEntries;

/**
 * Get employees.
 * @param {string} storeGUID - The Toast platform GUID of the restaurant that is the context for this operation.
 * @param {string[]} [employeeIds] - Optional. Arrary of Toast platform GUID or an external identifiers for the employess to return. Max 100.
 * @returns {Object} Object of Employee objects containing information about restaurant employees where the keys are employee Toast GUIDs.
 */
ToastAPI.prototype.getAllEmployees = employees.getAllEmployees;

/**
 * Get employees. Generator function, yeilds 1 page of results at a time.
 * @param {string} storeGUID - The Toast platform GUID of the restaurant that is the context for this operation.
 * @param {string[]} [employeeIds] - Optional. Arrary of Toast platform GUID or an external identifiers for the employess to return. Max 100.
 * @yields {Object[]} Array of Employee objects containing information about restaurant employees.
 */
ToastAPI.prototype.getEmployees = employees.getEmployees;

/**
 * Get jobs.
 * @param {string} storeGUID - The Toast platform GUID of the restaurant that is the context for this operation.
 * @param {string[]} [jobIds] - Optional. Arrary of Toast platform GUID or an external identifiers for the employess to return. Max 100.
 * @returns {Object} Object of Employee objects containing information about restaurant employees where the keys are employee Toast GUIDs.
 */
ToastAPI.prototype.getAllJobs = jobs.getAllJobs;

/**
 * Get jobs. Generator function, yeilds 1 page of results at a time.
 * @param {string} storeGUID - The Toast platform GUID of the restaurant that is the context for this operation.
 * @param {string[]} [jobIds] - Optional. Arrary of Toast platform GUID or an external identifiers for the employess to return. Max 100.
 * @yields {Object[]} Array of Employee objects containing information about restaurant employees.
 */
ToastAPI.prototype.getJobs = jobs.getJobs;

/**
 * Get shifts.
 * @param {string} storeGUID - The Toast platform GUID of the restaurant that is the context for this operation.
 * @param {string[]} [shiftIds] - Optional. Arrary of Toast platform GUID or an external identifiers for the employess to return. Max 100.
 * @returns {Object} Object of Employee objects containing information about restaurant employees where the keys are employee Toast GUIDs.
 */
ToastAPI.prototype.getAllShifts = shifts.getAllShifts;

/**
 * Get shifts. Generator function, yeilds 1 page of results at a time.
 * @param {string} storeGUID - The Toast platform GUID of the restaurant that is the context for this operation.
 * @param {string[]} [shiftIds] - Optional. Arrary of Toast platform GUID or an external identifiers for the employess to return. Max 100.
 * @yields {Object[]} Array of Employee objects containing information about restaurant employees.
 */
ToastAPI.prototype.getShifts = shifts.getShifts;


module.exports = ToastAPI