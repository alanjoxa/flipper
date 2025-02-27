/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import {FlipperPlugin, FlipperDevicePlugin} from 'flipper';
import {serialize} from './serialization';
import {State as PluginStatesState} from '../reducers/pluginStates';
import {Store} from '../reducers';
import fs from 'fs';
import {ExportType, fetchMetadata, pluginsClassMap} from './exportData';
import {deserializeObject} from './serialization';

export type MetricType = {[metricName: string]: number};
type MetricPluginType = {[pluginID: string]: MetricType};
export type ExportMetricType = {[clientID: string]: MetricPluginType};

async function exportMetrics(
  pluginStates: PluginStatesState,
  pluginsMap: Map<string, typeof FlipperDevicePlugin | typeof FlipperPlugin>,
  selectedPlugins: Array<string>,
): Promise<string> {
  const metrics: ExportMetricType = {};
  for (const key in pluginStates) {
    const pluginStateData = pluginStates[key];
    const arr = key.split('#');
    const pluginName = arr.pop();
    if (
      pluginName === undefined ||
      (selectedPlugins.length > 0 && !selectedPlugins.includes(pluginName))
    ) {
      continue;
    }
    const clientID = arr.join('#');
    const plugin = pluginsMap.get(pluginName);
    const metricsReducer:
      | (<U>(persistedState: U) => Promise<MetricType>)
      | null
      | undefined = plugin && plugin.metricsReducer;
    if (pluginsMap.has(pluginName) && metricsReducer) {
      const metricsObject = await metricsReducer(pluginStateData);
      const pluginObject: MetricPluginType = {};
      pluginObject[pluginName] = metricsObject;
      if (!metrics[clientID]) {
        metrics[clientID] = pluginObject;
        continue;
      }
      const mergedMetrics = {...metrics[clientID], ...pluginObject};
      metrics[clientID] = mergedMetrics;
    }
  }
  return Promise.resolve(await serialize(metrics));
}

export async function exportMetricsWithoutTrace(
  store: Store,
  pluginStates: PluginStatesState,
): Promise<string | null> {
  const pluginsMap: Map<
    string,
    typeof FlipperDevicePlugin | typeof FlipperPlugin
  > = pluginsClassMap(store.getState().plugins);
  const metadata = await fetchMetadata(
    store.getState().connections.clients,
    pluginStates,
    pluginsMap,
    store,
  );
  const newPluginStates = metadata.pluginStates;
  const {errorArray} = metadata;
  if (errorArray.length > 0) {
    console.error(errorArray);
  }

  const metrics = await exportMetrics(
    newPluginStates,
    pluginsMap,
    store.getState().plugins.selectedPlugins,
  );
  return metrics;
}

function parseJSON(str: string): any {
  try {
    return JSON.parse(str);
  } catch (e) {
    console.error(e);
    return undefined;
  }
}

export async function exportMetricsFromTrace(
  trace: string,
  pluginsMap: Map<string, typeof FlipperDevicePlugin | typeof FlipperPlugin>,
  selectedPlugins: Array<string>,
): Promise<string> {
  const data = fs.readFileSync(trace, 'utf8');
  const parsedJSONData = parseJSON(data);
  if (!parsedJSONData) {
    return Promise.reject(
      new Error('Please pass the file which has a valid JSON'),
    );
  }
  const importedData: ExportType = deserializeObject(parsedJSONData);
  const importedStore = importedData.store;
  if (!importedStore) {
    return Promise.reject(
      new Error(
        'No store in the imported file, thus exiting without exporting metrics.',
      ),
    );
  }

  const {pluginStates} = importedStore;

  if (!pluginStates) {
    return Promise.reject(
      new Error(
        'No pluginStates in the imported file, thus exiting without exporting metrics.',
      ),
    );
  }
  return await exportMetrics(pluginStates, pluginsMap, selectedPlugins);
}
