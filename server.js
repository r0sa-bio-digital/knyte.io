const fs = require('fs');

// state variables to save/load
let masterKnoxelId;
let spacemapKnoxelId;
const knyteVectors = {}; // knyte id --> {initialKnyteId, terminalKnyteId}
const knoxelVectors = {}; // knoxel id --> {initialKnoxelId, terminalKnoxelId}
const knyteConnects = {}; // knyte id --> {knyte id: true}
const knyteInitialConnects = {}; // knyte id --> {knyte id: true}
const knyteTerminalConnects = {}; // knyte id --> {knyte id: true}
const informationMap = {}; // knyte id --> {color, space: {knoxel id --> position}, record: {data, viewertype, size}}
const knoxels = {}; // knoxel id --> knyte id
const knoxelViews = {}; // knoxel id --> {collapse, color}

// state variables to reset on load
const knyteEvalCode = {}; // knyte id --> eval key --> function made from parameters and code
const arrows = {}; // arrow id --> {initialKnoxelId, terminalKnoxelId}
const spaceBackStack = []; // [previous space root knoxel id]
const steeringBackStack = []; // [previous space root steering]
const spaceForwardStack = []; // [next space root knoxel id]
const steeringForwardStack = []; // [next space root steering]

// global settings
let runBlockDelay = 0;
const runBlockBusyList = {};

function loadAppState(filename)
{
  function assignAppState(state)
  {
    function assignObject(source, destination)
    {
      for (let key in destination)
        delete destination[key];
      for (let key in source)
        destination[key] = source[key];
    }

    masterKnoxelId = state.masterKnoxelId;
    spacemapKnoxelId = state.spacemapKnoxelId;
    assignObject(state.knyteVectors, knyteVectors);
    assignObject(state.knoxelVectors, knoxelVectors);
    assignObject(state.knyteConnects, knyteConnects);
    assignObject(state.knyteInitialConnects, knyteInitialConnects);
    assignObject(state.knyteTerminalConnects, knyteTerminalConnects);
    assignObject(state.informationMap, informationMap);
    assignObject(state.knoxels, knoxels);
    assignObject(state.knoxelViews, knoxelViews);
    for (let key in knyteEvalCode)
      delete knyteEvalCode[key];
    for (let key in arrows)
      delete arrows[key];
    spaceBackStack.length = 0;
    steeringBackStack.length = 0;
    spaceForwardStack.length = 0;
    steeringForwardStack.length = 0;
  }

  // TODO: implement format check
  const rawdata = fs.readFileSync(filename);
  const state = JSON.parse(rawdata.toString());
  assignAppState(state);
}

function getConnectsByDataMatchFunction(knyteId, match, token, type)
{
  const result = [];
  let connects = knyteConnects;
  if (type === 'initial')
    connects = knyteInitialConnects;
  else if (type === 'terminal')
    connects = knyteTerminalConnects;
  const connectedKnytes = connects[knyteId];
  for (let connectedKnyteId in connectedKnytes)
  {
    const {record} = informationMap[connectedKnyteId];
    if (record && match(record.data, token))
      result.push(connectedKnyteId);
  }
  return result;
}

function isString(s)
{
  return s !== null && s !== undefined && s.constructor === String;
}

function escapeStringToCode(s) {
  return s.replace(/\\/g, '\\\\').replace(/\"/g, '\\\"').replace(/\n/g, '\\n');
}

function setKnyteRecordData(knyteId, recordtype, newData)
{
  const r = {data: newData, viewertype: recordtype};
  informationMap[knyteId].record = r;
}

function getRecordtype(record)
{
  return record ? record.viewertype : 'oneliner';
}

function logicReset(logicKnyteId)
{
  const hostedKnoxels = informationMap[logicKnyteId].space;
  for (let hostedKnoxelId in hostedKnoxels)
  {
    const knyteId = knoxels[hostedKnoxelId];
    resetTransparentOutline(hostedKnoxelId);
    const hostedKnoxels2 = informationMap[knyteId].space;
    const {record} = informationMap[knyteId];
    const {initialKnyteId, terminalKnyteId} = knyteVectors[knyteId];
    if (initialKnyteId && terminalKnyteId && record && (record.data === '-' || record.data === '+'))
      setKnyteRecordData(knyteId, 'oneliner', '.');
  }
}

function runBlockHandleClick(knyteId, body, finalKnyteId, resolve)
{
  if (!knyteId || !knyteVectors[knyteId])
  {
    const result = JSON.stringify({success: false, result: 'run block not found.'});
    resolve(result);
  }

  function onComplete(success, nextKnyteId)
  {
    if (success && nextKnyteId)
      runBlockHandleClick(nextKnyteId, null, finalKnyteId, resolve);
    else
    {
      let result = JSON.stringify({success: false, result: 'run block execution failed.'});
      if (success)
      {
        const record = finalKnyteId && informationMap[finalKnyteId] && informationMap[finalKnyteId].record ? informationMap[finalKnyteId].record : {};
        result = JSON.stringify({success: true, result: (record.data ? JSON.parse(record.data) : {})});
      }
      console.log('run block result: ' + result);
      resolve(result);
    }
  }
  
  function matchToken(data, token)
  {
    return data === token;
  }
  
  function matchDataParameter(data)
  {
    return data.length > 2 && data[0] === '(' && data[data.length-1] === ')';
  }

  function matchCaseParameter(data)
  {
    return data.length > 1 && data[0] === '=';
  }

  function extractParameterName(data)
  {
    return data.substr(1, data.length-2);
  }

  function extractCaseValue(data)
  {
    return data.substr(1, data.length-1);
  }

  const typeValidators = {
    string: function(value) {return true;},
    number: function(value) {
      return !isNaN(value) && 
        value !== 'true' && value !== 'false' && value !== true && value !== false;
    },
    bool: function(value) {
      return value === 'true' || value === 'false' || value === true || value === false;
    },
    json: function(value) {
      let success = false;
      try
      {
        if (isString(value))
          JSON.parse(value);
        success = true;
      }
      catch (e)
      {
        console.warn(e);
      }
      return success;
    },
  };
  
  function getValueCode(typeValidator, value)
  {
    if (typeValidator === typeValidators.string)
    {
      if (value === undefined || value === '')
        return '""';
      return '"' + escapeStringToCode(value) + '"';
    }
    return value;
  }

  function logicCallHandler(logicKnyteId)
  {
    logicReset(logicKnyteId);
    return logicCompute(logicKnyteId);
  }

  function logicCompute(logicKnyteId)
  {
    function markProcessedLink(knyteId, success)
    {
      setKnyteRecordData(knyteId, 'oneliner', success ? '+' : '-');
    }

    // TODO: implement semantic-code entities link via standard parameters
    const logicSemantics = {
      blocks: {
        root: '0f51a068-5ec8-4de1-b24c-f8aec06d00bb',
      },
      operators: {
        not: '8669eb2f-2d20-48c0-88ca-27c4e7a44ef2',
        and: '50b3066e-d0fd-4efc-806f-4f363a106092',
        or: '7dde3e82-2c0a-45e5-9bc1-04bb34034514',
        xor: 'de329bdf-eab1-4c61-a1d5-1d5e7810a3a5',
      },
    };

    function isLogicOperator(knyteId)
    {
      for (let operator in logicSemantics.operators)
      {
        const operatorKnyteId = logicSemantics.operators[operator];
        if (operatorKnyteId === knyteId)
          return true;
      }
      return false;
    }

    function computeValueByOperatorId(operatorKnyteId, incomeValues)
    {
      // get operator by knyte id
      let operator = null;
      for (let op in logicSemantics.operators)
      {
        const knyteId = logicSemantics.operators[op];
        if (operatorKnyteId === knyteId)
          operator = op;
      }
      if (operator === 'not')
      {
        if (incomeValues.length === 1)
          if (incomeValues[0] === true)
            return false;
          else if (incomeValues[0] === false)
            return true;
        return undefined;
      }
      else if (operator === 'and')
      {
        for (let i = 0; i < incomeValues.length; ++i)
        {
          if (incomeValues[i] === false)
            return false;
          if (incomeValues[i] === undefined)
            return undefined;
        }
        return incomeValues.length > 0 ? true : undefined;
      }
      else if (operator === 'or')
      {
        let result = false;
        for (let i = 0; i < incomeValues.length; ++i)
        {
          if (incomeValues[i] === true)
            result = true;
          if (incomeValues[i] === undefined)
            return undefined;
        }
        return incomeValues.length > 0 ? result : undefined;
      }
      else if (operator === 'xor')
      {
        let trueCounter = 0;
        for (let i = 0; i < incomeValues.length; ++i)
        {
          if (incomeValues[i] === true)
            ++trueCounter;
          if (incomeValues[i] === undefined)
            return undefined;
        }
        return incomeValues.length > 0 ? (trueCounter === 1) : undefined;
      }
      return undefined;
    }

    const hostedKnoxels = informationMap[logicKnyteId].space;
    const succeedKnytes = {};
    const dismissedKnytes = {};
    // get root
    const rootKnytes = {};
    for (let knoxelId in hostedKnoxels)
    {
      const knyteId = knoxels[knoxelId];
      if (getHostedKnyteId(knyteId) === logicSemantics.blocks.root)
        rootKnytes[knyteId] = true;
    }
    if (Object.keys(rootKnytes).length !== 1)
      return {complete: false, error: 'logic block must have 1 root block'};
    const rootKnyteId = Object.keys(rootKnytes)[0];
    succeedKnytes[rootKnyteId] = true;
    const rootLinks = getConnectsByDataMatchFunction(rootKnyteId, matchToken, '.', 'initial');
    // get groups
    const groupHostKnytes = {}; // {group host knyte id --> group knyte id}
    for (let i = 0; i < rootLinks.length; ++i)
    {
      const linkId = rootLinks[i];
      const groupHostId = knyteVectors[linkId].terminalKnyteId;
      const groupId = getHostedKnyteId(groupHostId);
      if (groupId)
      {
        groupHostKnytes[groupHostId] = groupId;
        succeedKnytes[linkId] = true;
        succeedKnytes[groupHostId] = true;
        markProcessedLink(linkId, true);
      }
      else
      {
        dismissedKnytes[linkId] = true;
        dismissedKnytes[groupHostId] = true;
        markProcessedLink(linkId, false);
      }
    }
    // group to values
    const groupValues = {}; // {group knyte id: {value level 1 knyte id --> value level 2 knyte id}}
    for (let groupHostId in groupHostKnytes)
    {
      const groupId = groupHostKnytes[groupHostId];
      const groupLinks = getConnectsByDataMatchFunction(groupId, matchToken, '=', 'initial');
      for (let i = 0; i < groupLinks.length; ++i)
      {
        const linkId = groupLinks[i];
        const valueLevel1HostId = knyteVectors[linkId].terminalKnyteId;
        const valueLevel1Id = getHostedKnyteId(valueLevel1HostId);
        const valueLinks = getConnectsByDataMatchFunction(valueLevel1HostId, matchToken, '=', 'initial');
        for (let j = 0; j < valueLinks.length; ++j)
        {
          const linkId = valueLinks[j];
          const valueLevel2HostId = knyteVectors[linkId].terminalKnyteId;
          const valueLevel2Id = getHostedKnyteId(valueLevel2HostId);
          if (!(groupId in groupValues))
            groupValues[groupId] = {};
          groupValues[groupId][valueLevel1Id] = valueLevel2Id;
        }
      }
    }
    const valueStates = {};
    for (let groupHostId in groupHostKnytes)
    {
      const groupId = groupHostKnytes[groupHostId];
      const groupHostLinks = getConnectsByDataMatchFunction(groupHostId, matchToken, '.', 'initial');
      for (let i = 0; i < groupHostLinks.length; ++i)
      {
        const linkId = groupHostLinks[i];
        const valueLevel1HostId = knyteVectors[linkId].terminalKnyteId;
        const valueLevel1Id = getHostedKnyteId(valueLevel1HostId);
        const valueHostLinks = getConnectsByDataMatchFunction(valueLevel1HostId, matchToken, '.', 'initial');
        for (let j = 0; j < valueHostLinks.length; ++j)
        {
          const linkId = valueHostLinks[j];
          const valueLevel2HostId = knyteVectors[linkId].terminalKnyteId;
          const valueLevel2Id = getHostedKnyteId(valueLevel2HostId);
          if (groupValues[groupId] && groupValues[groupId][valueLevel1Id] && groupValues[groupId][valueLevel1Id] === valueLevel2Id)
          {
            valueStates[valueLevel2HostId] = true;
            succeedKnytes[linkId] = true;
            succeedKnytes[valueLevel2HostId] = true;
            markProcessedLink(linkId, true);
          }
          else
          {
            valueStates[valueLevel2HostId] = false;
            dismissedKnytes[linkId] = true;
            dismissedKnytes[valueLevel2HostId] = true;
            markProcessedLink(linkId, false);
          }
        }
        if (groupValues[groupId] && groupValues[groupId][valueLevel1Id])
        {
          succeedKnytes[linkId] = true;
          succeedKnytes[valueLevel1HostId] = true;
          markProcessedLink(linkId, true);
        }
        else
        {
          dismissedKnytes[linkId] = true;
          dismissedKnytes[valueLevel1HostId] = true;
          markProcessedLink(linkId, false);
        }
      }
    }
    // get operators and results
    const operatorHostKnytes = {}; // {operator host knyte id --> operator knyte id}
    const resultHostKnytes = {}; // {result host knyte id --> result knyte id}
    for (let hostedKnoxelId in hostedKnoxels)
    {
      const hostKnyteId = knoxels[hostedKnoxelId];
      const knyteId = getHostedKnyteId(hostKnyteId);
      if (isLogicOperator(knyteId))
        operatorHostKnytes[hostKnyteId] = knyteId;
      else
        resultHostKnytes[hostKnyteId] = knyteId;
    }
    // process operators
    const maxComputeIterations = 128;
    let computeIteration = 0;
    while (computeIteration < maxComputeIterations)
    {
      let operatorsComputed = 0;
      for (operatorHostKnyteId in operatorHostKnytes)
      {
        if (valueStates[operatorHostKnyteId] !== undefined)
          continue;
        const incomeValues = [];
        const incomeValueKnytes = getConnectsByDataMatchFunction(operatorHostKnyteId, matchToken, '.', 'terminal');
        for (let i = 0; i < incomeValueKnytes.length; ++ i)
        {
          const linkId = incomeValueKnytes[i];
          const incomeValueHostId = knyteVectors[linkId].initialKnyteId;
          incomeValues.push(valueStates[incomeValueHostId]);
        }
        const operatorKnyteId = getHostedKnyteId(operatorHostKnyteId);
        const operatorValue = computeValueByOperatorId(operatorKnyteId, incomeValues);
        if (operatorValue !== undefined)
        {
          ++operatorsComputed;
          valueStates[operatorHostKnyteId] = operatorValue;
          if (operatorValue)
            succeedKnytes[operatorHostKnyteId] = true;
          else
            dismissedKnytes[operatorHostKnyteId] = true;
          for (let i = 0; i < incomeValueKnytes.length; ++ i)
          {
            const linkId = incomeValueKnytes[i];
            const incomeValueHostId = knyteVectors[linkId].initialKnyteId;
            if (valueStates[incomeValueHostId] === true)
            {
              succeedKnytes[linkId] = true;
              markProcessedLink(linkId, true);
            }
            else
            {
              dismissedKnytes[linkId] = true;
              markProcessedLink(linkId, false);
            }
          }
        }
      }
      if (!operatorsComputed)
        break;
      ++computeIteration;
    }
    // set results
    const maxResultIterations = 128;
    let resultIteration = 0;
    while (resultIteration < maxResultIterations)
    {
      let resultsComputed = 0;
      for (resultHostKnyteId in resultHostKnytes)
      {
        if (valueStates[resultHostKnyteId] !== undefined)
          continue;
        const incomeValueKnytes = getConnectsByDataMatchFunction(resultHostKnyteId, matchToken, '.', 'terminal');
        if (incomeValueKnytes.length !== 1)
          continue;
        const incomeValueLinkId = incomeValueKnytes[0];
        const incomeValueHostId = knyteVectors[incomeValueLinkId].initialKnyteId;
        const incomeValue = valueStates[incomeValueHostId];
        if (incomeValue === undefined)
          continue;
        ++resultsComputed;
        valueStates[resultHostKnyteId] = incomeValue;
        if (incomeValue)
        {
          succeedKnytes[incomeValueLinkId] = true;
          succeedKnytes[resultHostKnyteId] = true;
          markProcessedLink(incomeValueLinkId, true);
        }
        else
        {
          dismissedKnytes[incomeValueLinkId] = true;
          dismissedKnytes[resultHostKnyteId] = true;
          markProcessedLink(incomeValueLinkId, false);
        }
      }
      if (!resultsComputed)
        break;
      ++resultIteration;
    }
    // return result
    return {complete: true};
  }

  const codeKnytes = getConnectsByDataMatchFunction(knyteId, matchToken, 'code', 'terminal');
  const codeLinkKnyteId = codeKnytes[0];
  const codeKnyteId = codeLinkKnyteId ? knyteVectors[codeLinkKnyteId].initialKnyteId : undefined;
  const codeRecord = codeKnyteId ? informationMap[codeKnyteId].record : undefined;
  let codeText = codeRecord ? codeRecord.data : '';

  const logicKnytes = getConnectsByDataMatchFunction(knyteId, matchToken, 'logic', 'terminal');
  const logicLinkKnyteId = logicKnytes[0];
  const logicKnyteId = logicLinkKnyteId ? knyteVectors[logicLinkKnyteId].initialKnyteId : undefined;

  const nextKnytes = getConnectsByDataMatchFunction(knyteId, matchToken, 'next', 'initial');
  const nextLinkKnyteId = nextKnytes[0];
  const nextKnyteId = nextLinkKnyteId ? knyteVectors[nextLinkKnyteId].terminalKnyteId : undefined;
  const inputKnytes = getConnectsByDataMatchFunction(knyteId, matchDataParameter, undefined, 'terminal');
  const outputKnytes = getConnectsByDataMatchFunction(knyteId, matchDataParameter, undefined, 'initial');

  const ifKnytes = getConnectsByDataMatchFunction(knyteId, matchToken, 'if', 'terminal');
  const ifLinkKnyteId = ifKnytes[0];
  const ifKnyteId = ifLinkKnyteId ? knyteVectors[ifLinkKnyteId].initialKnyteId : undefined;
  const ifRecord = ifKnyteId ? informationMap[ifKnyteId].record : undefined;
  const ifText = ifRecord ? ifRecord.data : '';
  const elseKnytes = getConnectsByDataMatchFunction(knyteId, matchToken, 'else', 'initial');
  const elseLinkKnyteId = elseKnytes[0];
  const elseKnyteId = elseLinkKnyteId ? knyteVectors[elseLinkKnyteId].terminalKnyteId : undefined;
  const caseKnytes = getConnectsByDataMatchFunction(knyteId, matchCaseParameter, undefined, 'initial');

  const cases = {};
  for (let i = 0; i < caseKnytes.length; ++i)
  {
    const caseLinkKnyteId = caseKnytes[i];
    const caseKnyteId = caseLinkKnyteId ? knyteVectors[caseLinkKnyteId].terminalKnyteId: undefined;
    const caseRecord = informationMap[caseLinkKnyteId].record;
    const caseValue = caseRecord ? extractCaseValue(caseRecord.data) : undefined;
    if (caseValue !== undefined && caseKnyteId)
      cases[caseValue] = caseKnyteId;
  }
  
  const namesSequence = [];
  const inputNamesSequence = [];
  const inputs = {};
  const inputNameToKnyteMap = {};
  for (let i = 0; i < inputKnytes.length; ++i)
  {
    const inputLinkKnyteId = inputKnytes[i];
    const inputKnyteId = inputLinkKnyteId ? knyteVectors[inputLinkKnyteId].initialKnyteId : undefined;
    const inputLinkRecord = inputLinkKnyteId ? informationMap[inputLinkKnyteId].record : undefined;
    const inputRecord = inputKnyteId ? informationMap[inputKnyteId].record : undefined;
    const inputValue = inputRecord ? inputRecord.data : '';
    const inputName = inputLinkRecord ? extractParameterName(inputLinkRecord.data) : '';
    if (inputName)
    {
      inputs[inputName] = inputValue;
      namesSequence.push(inputName);
      inputNamesSequence.push(inputName);
      const name = inputName.split(':')[0];
      inputNameToKnyteMap[name] = inputKnyteId;
    }
  }
  const outputNamesSequence = [];
  const outputs = {};
  const outputNameToKnyteMap = {};
  for (let i = 0; i < outputKnytes.length; ++i)
  {
    const outputLinkKnyteId = outputKnytes[i];
    const outputKnyteId = outputLinkKnyteId ? knyteVectors[outputLinkKnyteId].terminalKnyteId : undefined;
    const outputLinkRecord = outputLinkKnyteId ? informationMap[outputLinkKnyteId].record : undefined;
    const outputRecord = outputKnyteId ? informationMap[outputKnyteId].record : undefined;
    const outputValue = outputRecord ? outputRecord.data : '';
    const outputName = outputLinkRecord ? extractParameterName(outputLinkRecord.data) : '';
    if (outputName)
    {
      outputs[outputName] = outputValue;
      namesSequence.push(outputName);
      outputNamesSequence.push(outputName);
      const name = outputName.split(':')[0];
      outputNameToKnyteMap[name] = outputKnyteId;
    }
  }

  if (body)
  {
    if (inputs['body:json'])
    {
      const value = JSON.stringify(body, null, '\t');
      inputs['body:json'] = value;
      setKnyteRecordData(inputNameToKnyteMap.body, 'multiliner', value);
    }
    if (outputs['result:json'])
      finalKnyteId = outputNameToKnyteMap.result;
  }
  let runComplete = false;
  try
  {
    if (codeKnytes.length > 1)
      throw Error('run block knyte ' + knyteId + ' has more than 1 code links');
    if (logicKnytes.length > 1)
      throw Error('run block knyte ' + knyteId + ' has more than 1 logic links');
    if (nextKnytes.length > 1)
      throw Error('run block knyte ' + knyteId + ' has more than 1 next links');
    if (ifKnytes.length > 1)
      throw Error('run block knyte ' + knyteId + ' has more than 1 if links');
    if (caseKnytes.length !== Object.keys(cases).length)
      throw Error('run block knyte ' + knyteId + ' has duplicated case links');
    if (elseKnytes.length > 1)
      throw Error('run block knyte ' + knyteId + ' has more than 1 else links');
    if (!ifKnytes.length && (caseKnytes.length || elseKnytes.length))
      throw Error('run block knyte ' + knyteId + ' has case/else links without if link');
    if (ifKnytes.length || caseKnytes.length || elseKnytes.length)
    {
      if (codeKnytes.length)
        throw Error('run block knyte ' + knyteId + ' has mixed code and if-cases-else links');
      if (logicKnytes.length)
        throw Error('run block knyte ' + knyteId + ' has mixed logic and if-cases-else links');
      if (nextKnytes.length)
        throw Error('run block knyte ' + knyteId + ' has mixed next and if-cases-else links');
    }
    if (logicKnytes.length && codeKnytes.length)
      throw Error('run block knyte ' + knyteId + ' has mixed code and logic links');
    const namesMap = {};
    for (let i = 0; i < namesSequence.length; ++i)
    {
      const nameType = namesSequence[i].split(':');
      const name = nameType[0];
      const type = nameType[1];
      if (name in namesMap)
        throw Error('duplicated parameter name: ' + name);
      const typeValidator = type ? typeValidators[type] : typeValidators.string;
      if (!typeValidator)
        throw Error('type validator not found for (' + namesSequence[i] + ')');
      namesMap[name] = {type, typeValidator};
    }
    let formalParametersList = '';
    let actualParametersList = '';
    for (let i = 0; i < inputNamesSequence.length; ++i)
    {
      const name = inputNamesSequence[i].split(':')[0];
      formalParametersList += '"' + name + '", ';
      const {typeValidator} = namesMap[name];
      const value = inputs[inputNamesSequence[i]];
      if (!typeValidator(value))
        throw Error('invalid value for (' + inputNamesSequence[i] + '): ' + value);
      actualParametersList += (i > 0 ? ', ' : '') + getValueCode(typeValidator, value);
    }
    if (outputNamesSequence.length)
    {
      let outputParametersDefinition = 'let ';
      let outputParametersReturn = '\nreturn {';
      for (let i = 0; i < outputNamesSequence.length; ++i)
      {
        const name = outputNamesSequence[i].split(':')[0];
        outputParametersDefinition += (i > 0 ? ', ' : '') + name;
        outputParametersReturn += (i > 0 ? ', ' : '') + name;
      }
      outputParametersDefinition += '; // autogenerated code line\n';
      outputParametersReturn += '}; // autogenerated code line';
      codeText = outputParametersDefinition + codeText + outputParametersReturn;
    }
    const useStrict = '"use strict";\n';
    if (ifKnyteId)
    {
      const evalConditionKey = 'if-case-else' + formalParametersList + ifText;
      const evalConditionText = 'new Function(' + formalParametersList + 'useStrict + "return (" + ifText + ");")';
      if (!(knyteId in knyteEvalCode))
        knyteEvalCode[knyteId] = {};
      if (!(evalConditionKey in knyteEvalCode[knyteId]))
        knyteEvalCode[knyteId][evalConditionKey] = eval(evalConditionText);
      const conditionFunction = knyteEvalCode[knyteId][evalConditionKey];
      runBlockBusyList[knyteId] = true;
      setTimeout(
        function()
        {
          delete runBlockBusyList[knyteId];
          let conditionComplete = false;
          let conditionKnyteId;
          try
          {
            const result = eval('conditionFunction(' + actualParametersList + ')');
            conditionKnyteId = cases[result] ? cases[result] : elseKnyteId;
            conditionComplete = true;
          }
          finally
          {
            onComplete(conditionComplete, conditionKnyteId);
          }
        }, 
        runBlockDelay
      );
    }
    else if (logicKnyteId)
    {
      runBlockBusyList[knyteId] = true;
      setTimeout(
        function()
        {
          delete runBlockBusyList[knyteId];
          const logicResult = logicCallHandler(logicKnyteId);
          onComplete(logicResult.complete, nextKnyteId);
          if (!logicResult.complete)
            throw Error(logicResult.error);
        },
        runBlockDelay
      );
    }
    else
    {
      const evalKey = 'code-next' + formalParametersList + codeText;
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const evalText = 'new AsyncFunction(' + formalParametersList + 'useStrict + codeText)';
      if (!(knyteId in knyteEvalCode))
        knyteEvalCode[knyteId] = {};
      if (!(evalKey in knyteEvalCode[knyteId]))
        knyteEvalCode[knyteId][evalKey] = eval(evalText);
      const codeFunction = knyteEvalCode[knyteId][evalKey];
      runBlockBusyList[knyteId] = true;
      setTimeout(
        function()
        {
          let promiseComplete = false;
          try
          {
            let codeComplete = false;
            const promiseResults = eval('codeFunction(' + actualParametersList + ')');
            promiseResults.then(
              function(results)
              {
                let gotOutput = false;
                for (let resultName in results)
                {
                  const {type, typeValidator} = namesMap[resultName];
                  const value = results[resultName];
                  if (!typeValidator(value))
                    throw Error('invalid value for (' + resultName + ':' + type + '): ' + value);
                }
                for (let resultName in results)
                {
                  let resultValue = results[resultName];
                  if (resultValue === undefined)
                    continue;
                  if (!isString(resultValue))
                    resultValue = JSON.stringify(resultValue);
                  const resultKnyteId = outputNameToKnyteMap[resultName];
                  const {record} = informationMap[resultKnyteId];
                  const recordtype = getRecordtype(record);
                  setKnyteRecordData(resultKnyteId, recordtype, resultValue);
                  gotOutput = true;
                }
                codeComplete = true;
              }
            ).finally(
              function()
              {
                delete runBlockBusyList[knyteId];
                onComplete(codeComplete, nextKnyteId);
              }
            );
            promiseComplete = true;
          }
          finally
          {
            if (!promiseComplete)
            {
              delete runBlockBusyList[knyteId];
              onComplete(false);
            }
          }
        }, 
        runBlockDelay
      );
    }
    runComplete = true;
  }
  finally
  {
  }
}

exports.loadAppState = loadAppState;
exports.runBlockHandleClick = runBlockHandleClick;