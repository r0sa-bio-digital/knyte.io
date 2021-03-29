function matchToken(data, token)
{
    return data === token;
}

function parseCollectionGraph(knyteId)
{
    const elementTypeNames = ['string', 'string?', 'number', 'number?'];

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
    const typesOrder = [];
    while (fieldId && fieldCount < maxFieldCount)
    {
        fieldsOrder.push(fieldId);
        const typeLinks = getConnectsByDataMatchFunction(fieldId, matchToken, 'type', 'initial');
        if (typeLinks.length > 1)
            throw Error(fieldId + ' must have 1 outgoing link with token type');
        let typeName = 'string';
        if (typeLinks.length === 1)
        {
            const typeLinkId = typeLinks[0];
            const typeFieldId = knyteVectors[typeLinkId].terminalKnyteId;
            typeName = informationMap[typeFieldId].record.data;
            if (!elementTypeNames.includes(typeName))
                throw Error(typeName + ' - invalid type');
        }
        typesOrder.push(typeName);
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
        row0.push(fieldId + '\n' + fieldName + '\n' + typesOrder[i]);
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
            const data = (record && record.data) ? record.data : getHostedKnyteId(fieldId);
            const fieldValue = data || '';
            entityValues.push(fieldValue);
            ++fieldIndex;
        }
        result.push(entityValues);
    }
    return result;
}

function appendEntitiesToCollectionGraph(hostKnyteId, entityDescs)
{
    function addEntity(desc)
    {
        // desc: {data, position, color}

        const knyteId = knit.new();
        const {data, position, color} = desc;
        addKnyte({knyteId, color});
        const knoxelId = knit.new();
        addKnoxel({hostKnyteId, knyteId, knoxelId, position, collapse: false});
        if (data)
            informationMap[knyteId].record = getOnelinerRecordByData(data);
        return {knyteId, knoxelId};
    }

    function importEntity(desc)
    {
        // desc: {knyteId, data, position, color}

        const {knyteId, data, position, color} = desc;
        addKnyte({knyteId, color});
        const knoxelId = knit.new();
        addKnoxel({hostKnyteId, knyteId, knoxelId, position, collapse: false});
        if (data)
            informationMap[knyteId].record = getOnelinerRecordByData(data);
        return {knyteId, knoxelId};
    }

    function cloneEntity(desc)
    {
        // desc: {knyteId, hostKnyteId, position}

        const {knyteId, hostKnyteId, position} = desc;
        const knoxelId = knit.new();
        addKnoxel({hostKnyteId, knyteId, knoxelId, position, collapse: false});
        return {knyteId, knoxelId};
    }

    function findKnoxel(knyteId)
    {
        const hostSpace = informationMap[hostKnyteId].space;
        if (!hostSpace)
            throw Error(hostKnyteId + ' must have space');
        let knoxelId;
        let knoxelsCount = 0;
        for (let hostedKnoxeId in hostSpace)
            if (knoxels[hostedKnoxeId] === knyteId)
            {
                if (!knoxelId)
                    knoxelId = hostedKnoxeId;
                ++knoxelsCount;
            }
        if (knoxelsCount !== 1)
            throw Error(hostKnyteId + ' must have 1 knoxel for knyte ' + knyteId);
        return knoxelId;
    }

    // get root
    const rootLinks = getConnectsByDataMatchFunction(hostKnyteId, matchToken, 'root', 'initial');
    if (rootLinks.length !== 1)
        throw Error(hostKnyteId + ' must have 1 outgoing link with token root');
    const rootLinkId = rootLinks[0];
    let rootKnyteId = knyteVectors[rootLinkId].terminalKnyteId;
    if (!rootKnyteId)
        throw Error(hostKnyteId + ' must have root knoxel');
    const rootKnoxelId = findKnoxel(rootKnyteId);

    // get fields header x positions
    const columnsPositions = [];
    const fieldLinks = getConnectsByDataMatchFunction(rootKnyteId, matchToken, 'header', 'initial');
    if (fieldLinks.length !== 1)
        throw Error(rootKnyteId + ' must have 1 outgoing link with token header');
    const fieldLinkId = fieldLinks[0];
    const fieldLinkKnoxelId = findKnoxel(fieldLinkId);
    columnsPositions.push(getKnoxelPosition(hostKnyteId, fieldLinkKnoxelId).x);
    let fieldId = knyteVectors[fieldLinkId].terminalKnyteId;
    if (!fieldId)
        throw Error(fieldId + ' must have header knoxel');
    const maxFieldCount = 100;
    let fieldCount = 0;
    const fieldsOrder = [];
    while (fieldId && fieldCount < maxFieldCount)
    {
        const fieldKnoxelId = findKnoxel(fieldId);
        columnsPositions.push(getKnoxelPosition(hostKnyteId, fieldKnoxelId).x);
        fieldsOrder.push(fieldId);
        const fieldLinks = getConnectsByDataMatchFunction(fieldId, matchToken, 'next', 'initial');
        if (fieldLinks.length === 0)
            break;
        if (fieldLinks.length > 1)
            throw Error(fieldId + ' must have 1 outgoing link with token next');
        const fieldLinkId = fieldLinks[0];
        const fieldLinkKnoxelId = findKnoxel(fieldLinkId);
        columnsPositions.push(getKnoxelPosition(hostKnyteId, fieldLinkKnoxelId).x);
        fieldId = knyteVectors[fieldLinkId].terminalKnyteId;
        ++fieldCount;
    }

    // get last entity number
    const maxEntityIndex = 100000;
    let lastEntityIndex;
    let lastEntityKnoxelId;
    for (let entityIndex = 1; entityIndex < maxEntityIndex; ++entityIndex)
    {
        const token = 'entity ' + entityIndex;
        const entityLinks = getConnectsByDataMatchFunction(rootKnyteId, matchToken, token, 'initial');
        if (entityLinks.length === 0)
        {
            lastEntityIndex = entityIndex;
            break;
        }
        if (entityLinks.length > 1)
            throw Error(rootKnyteId + ' must have 1 outgoing link with token ' + token);
        const entityLinkId = entityLinks[0];
        const entityKnyteId = knyteVectors[entityLinkId].terminalKnyteId;
        const entityKnoxelId = findKnoxel(entityKnyteId);
        lastEntityKnoxelId = entityKnoxelId;
    }

    // get space bottom y position
    const lastPosition = getKnoxelPosition(hostKnyteId, lastEntityKnoxelId || fieldLinkKnoxelId);

    // add series of linked knoxels to x,y
    const xstep = 150, ystep = 90;
    let y = lastPosition.y + ystep;
    let nextKnyteId;
    for (let i = 0; i < entityDescs.length; ++i)
    {
        let columnIndex = 0;
        let x = columnsPositions[columnIndex++];
        const entityDesc = entityDescs[i];   
        let lastCellPair;
        let lastNextPair;
        for (let j = 0; j < entityDesc.length; ++j)
        {
            const fieldValue = entityDesc[j];
            if (j === 0)
            {
                const position = {x, y};
                const entityPair = addEntity({data: 'entity ' + (lastEntityIndex + i), position, color: '#b98e01'});
                let idPair;
                x = columnsPositions[columnIndex] ? columnsPositions[columnIndex++] : x + xstep;
                if (isUuid(fieldValue))
                {
                    const position = {x, y};
                    if (fieldValue in informationMap)
                        idPair = cloneEntity({knyteId: fieldValue, hostKnyteId, position});
                    else
                        idPair = importEntity({knyteId: fieldValue, data: '{?}', position, color: '#bb99ff'});
                    x = columnsPositions[columnIndex] ? columnsPositions[columnIndex++] : x + xstep;
                }
                else
                {
                    const position = {x, y};
                    idPair = addEntity({data: fieldValue, position, color: '#bb99ff'});
                    x = columnsPositions[columnIndex] ? columnsPositions[columnIndex++] : x + xstep;
                }
                assignKnyteVectorInitial({jointKnyteId: entityPair.knyteId, initialKnyteId: rootKnyteId});
                assignKnoxelVectorInitial({jointKnoxelId: entityPair.knoxelId, initialKnoxelId: rootKnoxelId});
                assignKnyteVectorTerminal({jointKnyteId: entityPair.knyteId, terminalKnyteId: idPair.knyteId});
                assignKnoxelVectorTerminal({jointKnoxelId: entityPair.knoxelId, terminalKnoxelId: idPair.knoxelId});
                lastCellPair = idPair;
            }
            else if (isUuid(fieldValue))
            {
                const position = {x, y};
                const newPair = addEntity({position, color: '#bb99ff'})
                x = columnsPositions[columnIndex] ? columnsPositions[columnIndex++] : x + xstep;
                cloneEntity({knyteId: fieldValue, hostKnyteId: newPair.knyteId, position: {x: 0, y: 0}});
                lastCellPair = newPair;
            }
            else
            {
                const position = {x, y};
                const newPair = addEntity({data: fieldValue, position, color: '#bb99ff'});
                x = columnsPositions[columnIndex] ? columnsPositions[columnIndex++] : x + xstep;
                lastCellPair = newPair;
            }
            if (lastNextPair)
            {
                assignKnyteVectorTerminal({jointKnyteId: lastNextPair.knyteId, terminalKnyteId: lastCellPair.knyteId});
                assignKnoxelVectorTerminal({jointKnoxelId: lastNextPair.knoxelId, terminalKnoxelId: lastCellPair.knoxelId});
            }
            if (j < entityDesc.length - 1)
            {
                const position = {x, y};
                const nextPair = addEntity({data: 'next', position, color: '#ffc0cb'})
                x = columnsPositions[columnIndex] ? columnsPositions[columnIndex++] : x + xstep;
                assignKnyteVectorInitial({jointKnyteId: nextPair.knyteId, initialKnyteId: lastCellPair.knyteId});
                assignKnoxelVectorInitial({jointKnoxelId: nextPair.knoxelId, initialKnoxelId: lastCellPair.knoxelId});
                lastNextPair = nextPair;
            }
            else
                lastNextPair = null;
        }
        y += ystep;
    }
}