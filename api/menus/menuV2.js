
module.exports.getMenus = async function(storeGUID) {
    await this._getAccessToken();
    
    const res = await this.axios.get(
        '/menus/v2/menus',
        {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Toast-Restaurant-External-ID': storeGUID
            }
        }
    ).catch(e => { throw e.response.data });

    return res.data;
}

module.exports.getMenuTimestamp = async function(storeGUID) {
    await this._getAccessToken();
    
    const res = await this.axios.get(
        '/menus/v2/metadata',
        {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Toast-Restaurant-External-ID': storeGUID
            }
        }
    ).catch(e => { throw e.response.data });

    return res.data;
}