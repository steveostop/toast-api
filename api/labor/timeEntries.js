
module.exports.getAllTimeEntries = async function(storeGUID, startTime, endTime) {
    await this._getAccessToken();
    const route = '/labor/v1/timeEntries';
    const start = new Date(startTime);
    
    const params = {};
    if (!endTime) {
        params.businessDate = start.toISOString().substring(0,10).replace(/-/g,'');
    }
    else {
        params.startDate = start;
        params.endDate = new Date(endTime);
    }
    
    const data = [];
    let nextlink;
    do {
        const res = await this._axios.get(
            nextlink ? nextlink : route,
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
}

module.exports.getTimeEntries = async function*(storeGUID, startTime, endTime) {
    await this._getAccessToken();
    const route = '/labor/v1/timeEntries';
    const start = new Date(startTime);
    
    const params = {};
    if (!endTime) {
        params.businessDate = start.toISOString().substring(0,10).replace(/-/g,'');
    }
    else {
        params.startDate = start;
        params.endDate = new Date(endTime);
    }
    
    let nextlink;
    do {
        const res = await this._axios.get(
            nextlink ? nextlink : route,
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
}