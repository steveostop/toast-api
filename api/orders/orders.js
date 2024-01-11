
module.exports.getAllOrders = async function(storeGUID, startTime, endTime) {
    await this._getAccessToken();
    
    const params = {};
    if (!endTime) {
        params.businessDate = startTime.toISOString().substring(0,10).replace(/-/g,'');
    }
    else {
        params.startDate = startTime;
        params.endDate = endTime;
    }
    
    const data = [];
    let nextlink;
    do {
        const res = await this._axios.get(
            nextlink ? nextlink : '/orders/v2/ordersBulk',
            {
                params: params,
                headers: {
                    'Authorization': `Bearer ${this._accessToken}`,
                    'Toast-Restaurant-External-ID': storeGUID
                }
            }
        ).catch(e => { throw e.response.data });
        data.push(...res.data);
        const links = this._parseLink(res.headers.link);
        nextlink = links?.next;
    } while (nextlink)

    return data;
};

module.exports.getOrders = async function*(storeGUID, startTime, endTime) {
    await this._getAccessToken();
    
    const params = {};
    if (!endTime) {
        params.businessDate = startTime.toISOString().substring(0,10).replace(/-/g,'');
    }
    else {
        params.startDate = startTime;
        params.endDate = endTime;
    }
    
    let nextlink;
    do {
        const res = await this._axios.get(
            nextlink ? nextlink : '/orders/v2/ordersBulk',
            {
                params: params,
                headers: {
                    'Authorization': `Bearer ${this._accessToken}`,
                    'Toast-Restaurant-External-ID': storeGUID
                }
            }
        ).catch(e => { throw e.response.data });
        const links = this._parseLink(res.headers.link);
        nextlink = links?.next;
        yield res.data;
    } while (nextlink)
};

module.exports.getOrder = async function(storeGUID, orderGUID) {
    await this._getAccessToken();
       
    const res = await this._axios.get(
    `/orders/v2/orders/${orderGUID}`,
    {
        headers: {
            'Authorization': `Bearer ${this._accessToken}`,
            'Toast-Restaurant-External-ID': storeGUID
        }
    }).catch(e => { throw e.response.data });
    
    return res.data;
};