function matchToken(data, token)
{
    return data === token;
}

function parseCollectionGraph(knyteId)
{
    const rootLinks = getConnectsByDataMatchFunction(knyteId, matchToken, 'root', 'initial');
    if (rootLinks.length !== 1)
        throw Error(knyteId + ' must have 1 outgoing link with token root');
    const rootLinkId = rootLinks[0];
    let rootId = knyteVectors[rootLinkId].terminalKnyteId;
    if (!rootId)
        throw Error(knyteId + ' must have root knoxel');

    const fieldLinks = getConnectsByDataMatchFunction(rootId, matchToken, 'header', 'initial');
    if (fieldLinks.length !== 1)
        throw Error(rootId + ' must have 1 outgoing link with token header');
    const fieldLinkId = fieldLinks[0];
    let fieldId = knyteVectors[fieldLinkId].terminalKnyteId;
    if (!fieldId)
        throw Error(fieldId + ' must have header knoxel');
    const maxFieldCount = 100;
    let fieldCount = 0;
    const fieldsOrder = [];
    while (fieldId && fieldCount < maxFieldCount)
    {
        fieldsOrder.push(fieldId);
        const fieldLinks = getConnectsByDataMatchFunction(fieldId, matchToken, 'next', 'initial');
        if (fieldLinks.length === 0)
            break;
        if (fieldLinks.length > 1)
            throw Error(fieldId + ' must have 1 outgoing link with token next');
        const fieldLinkId = fieldLinks[0];
        fieldId = knyteVectors[fieldLinkId].terminalKnyteId;
        ++fieldCount;
    }

    const result = [];
    const row0 = [];
    for (let i = 0; i < fieldsOrder.length; ++i)
    {
        const fieldId = fieldsOrder[i];
        const fieldName = informationMap[fieldId].record.data;
        row0.push(fieldId + '\n' + fieldName);
    }
    result.push(row0);
    const maxEntityIndex = 100000;
    for (let entityIndex = 1; entityIndex < maxEntityIndex; ++entityIndex)
    {
        const token = 'entity ' + entityIndex;
        const entityLinks = getConnectsByDataMatchFunction(rootId, matchToken, token, 'initial');
        if (entityLinks.length === 0)
            break;
        if (entityLinks.length > 1)
            throw Error(rootId + ' must have 1 outgoing link with token ' + token);
        const entityLinkId = entityLinks[0];
        const entityId = knyteVectors[entityLinkId].terminalKnyteId;
        
        const entityValues = [];
        let fieldId = entityId;
        entityValues.push(entityId);
        let fieldIndex = 1;
        while (fieldId && fieldIndex < maxFieldCount)
        {
            const fieldLinks = getConnectsByDataMatchFunction(fieldId, matchToken, 'next', 'initial');
            if (fieldLinks.length === 0)
                break;
            if (fieldLinks.length > 1)
                throw Error(fieldId + ' must have 1 outgoing link with token next');
            if (fieldIndex >= fieldsOrder.length)
                throw Error(fieldId + ' must have corresponding field in the header');
            const fieldLinkId = fieldLinks[0];
            fieldId = knyteVectors[fieldLinkId].terminalKnyteId;
            const headerFieldId = fieldsOrder[fieldIndex];
            const {record} = informationMap[fieldId];
            const data = record ? record.data : getHostedKnyteId(fieldId);
            const fieldValue = data || '';
            entityValues.push(fieldValue);
            ++fieldIndex;
        }
        result.push(entityValues);
    }
    return result;
}

function appendEntitiesToCollectionGraph(knyteId, entityDescs)
{
    // get root
    // get last entity number
    // get get fields header x positions
    // get space bottom y position
    // add series of linked knoxels to x,y
    for (let i = 0; i < entityDescs.length; ++i)
    {
        const entityDesc = entityDescs[i];   
        for (let j = 0; j < entityDesc.length; ++j)
        {
            const fieldValue = entityDesc[j];
            if (j === 0)
            {
                if (isUuid(fieldValue))
                    console.log('main entity'); // process as main entity
                else
                    console.log('new entity'); // process as new entity
            }
            else if (isUuid(fieldValue))
                console.log('nested value'); // process as nested entity
            else
                console.log('plain value'); // process as value
        }
        console.log('entity done');
    }
}