
module.exports.getAllEmployees = async function(storeGUID, employeeIds) {
    await this._getAccessToken();
    const route = '/labor/v1/employees';
    
    const params = {};
    const data = {};
    let nextlink;

    do {
        if (employeeIds) params.employeeIds = employeeIds.splice(0, 100);
        
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
            { func: 'getAllEmployees' }
        )});

        for (let i = 0; i < res.data.length; i++) data[res.data[i].guid] = res.data[i];
        const links = this._parseLink(res.headers.link);
        nextlink = links?.next;

    } while (nextlink || employeeIds.length > 0)

    return data;
};

module.exports.getEmployees = async function*(storeGUID, employeeIds) {
    await this._getAccessToken();
    const route = '/labor/v1/employees';
    
    const params = {};
    if (employeeIds) {
        params.employeeIds = employeeIds;
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
};

