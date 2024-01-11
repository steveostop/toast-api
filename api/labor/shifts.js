module.exports.getAllShifts = async function(storeGUID, shiftIds) {
    if (!shiftIds || shiftIds.length === 0) return {};

    const isMultiCall = shiftIds.length > 100 ? true : false;

    await this._getAccessToken();
    const route = '/labor/v1/shifts';
    
    const data = {};
    let nextlink;
    do {
        const params = new URLSearchParams();
        //console.log('shift Id Lengths', shiftIds.length);
        if (shiftIds) {
            const shiftIdsBlock = shiftIds.splice(0, 100);
            for (let i = 0; i < shiftIdsBlock.length; i++) params.append('shiftIds', shiftIdsBlock[i]);
        }
        
        const res = await this._axios.get(
            nextlink ? nextlink : route,
            {
                params: params,
                headers: {
                    'Authorization': `Bearer ${this._accessToken}`,
                    'Toast-Restaurant-External-ID': storeGUID
                }
            }
        ).catch(e => { throw Object.assign(
            e.response.data,
            { func: 'getAllShifts' }
        )});

        for (let i = 0; i < res.data.length; i++) data[res.data[i].guid] = res.data[i];
        const links = this._parseLink(res.headers.link);
        nextlink = links?.next;

    } while (nextlink || shiftIds.length > 0)

    return data;
};

// TODO: implement getting shifts by start and end date
module.exports.getShifts = async function*(storeGUID, shiftIds) {
    await this._getAccessToken();
    const route = '/labor/v1/shifts';
    
    const params = new URLSearchParams();
    let nextlink;

    do {
        if (shiftIds) {
            const shiftIdsBlock = shiftIds.splice(0, 100);
            for (let i = 0; i < shiftIdsBlock.length; i++) params.append('shiftIds', shiftIdsBlock[i]);
        }

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
    } while (nextlink || shiftIds.length > 0)
};

