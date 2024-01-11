
module.exports.getAllRevenueCenters = async function(storeGUID = this._storeGuid, guid) {
    await this._getAccessToken();
        
    const data = {};
    let nextlink;
    do {
        const res = await this._axios.get(
            nextlink ? nextlink : `/config/v2/revenueCenters${guid ? `/${guid}` : ''}`,
            {
                headers: {
                    'Authorization': `Bearer ${this._accessToken}`,
                    'Toast-Restaurant-External-ID': storeGUID
                }
            }
        ).catch(e => { throw e.response.data });
        
        // process data
        if (!guid) {
            for (let i = 0; i < res.data.length; i++) {
                data[res.data[i].guid] = res.data[i];
            }
        }

        const links = this._parseLink(res.headers.link);
        nextlink = links?.next;
    } while (nextlink)

    return guid ? res.data : data;
};

module.exports.getAllTables = async function(storeGUID) {
    await this._getAccessToken();
        
    const data = {};
    let nextlink;
    do {
        const res = await this._axios.get(
            nextlink ? nextlink : '/config/v2/tables',
            {
                headers: {
                    'Authorization': `Bearer ${this._accessToken}`,
                    'Toast-Restaurant-External-ID': storeGUID
                }
            }
        ).catch(e => { throw e.response.data });
        
        // process data
        for (let i = 0; i < res.data.length; i++) {
            data[res.data[i].guid] = res.data[i];
        }

        const links = this._parseLink(res.headers.link);
        nextlink = links?.next;
    } while (nextlink)

    return data;
};

module.exports.getAllDiningOptions = async function(storeGUID) {
    await this._getAccessToken();
        
    const data = {};
    let nextlink;
    do {
        const res = await this._axios.get(
            nextlink ? nextlink : '/config/v2/diningOptions',
            {
                headers: {
                    'Authorization': `Bearer ${this._accessToken}`,
                    'Toast-Restaurant-External-ID': storeGUID
                }
            }
        ).catch(e => { throw e.response.data });
        
        // process data
        for (let i = 0; i < res.data.length; i++) {
            data[res.data[i].guid] = res.data[i];
        }

        const links = this._parseLink(res.headers.link);
        nextlink = links?.next;
    } while (nextlink)

    return data;
};

module.exports.getAllVoidReasons = async function(storeGUID) {
    await this._getAccessToken();
        
    const data = {};
    let nextlink;
    do {
        const res = await this._axios.get(
            nextlink ? nextlink : '/config/v2/voidReasons',
            {
                headers: {
                    'Authorization': `Bearer ${this._accessToken}`,
                    'Toast-Restaurant-External-ID': storeGUID
                }
            }
        ).catch(e => { throw e.response.data });
        
        // process data
        for (let i = 0; i < res.data.length; i++) {
            data[res.data[i].guid] = res.data[i];
        }

        const links = this._parseLink(res.headers.link);
        nextlink = links?.next;
    } while (nextlink)

    return data;
};
