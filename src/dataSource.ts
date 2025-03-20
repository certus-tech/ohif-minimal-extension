import {
  StudyInstanceUID,
  SeriesInstanceUID,
  InstanceInstanceUID,
  IWebApiDataSource,
} from '@ohif/core';

import { DICOMWeb, utils } from '@ohif/core';

import studies from './data/studies-doc.json';
import series from './data/series.json';
import metadata from './data/metadata.json';

/*
Data Types:
  LO: Long String
  PN: Person Name
  DA: Date
  CS: Code String
  SH: Short String
  UI: Unique Identifier
  TM: Time
  IS: Integer String
*/
const DICOM_KEY_StudyInstanceUid         = '0020000D'; // (UI): Study Instance UID - A globally unique identifier for the study.
const DICOM_KEY_PatientId                = '00100020'; // (LO): Patient ID - A unique identifier for the patient.
const DICOM_KEY_StudyDate                = '00080020'; // (DA): Study Date - The date the study was performed.
const DICOM_KEY_StudyTime                = '00080030'; // (TM): Study Time - The time the study was performed.
const DICOM_KEY_AccessionNumber          = '00080050'; // (SH): Accession Number - A unique identifier for the study.
const DICOM_KEY_PatientName              = '00100010'; // (PN): Patient's Name - The name of the patient.
const DICOM_KEY_NumStudyRelatedInstances = '00201208'; // (IS): Number of Study Related Instances - The total number of instances (images or other files) associated with the study.
const DICOM_KEY_StudyDescription         = '00081030'; // (LO): Study Description - A description of the study.
const DICOM_KEY_Modality                 = '00080060'; // (CS): Modality - Within a single series of images.
const DICOM_KEY_ModalitiesInStudy        = '00080061'; // (CS): Modality - The type of imaging modality used (e.g., CT for Computed Tomography, PT for Positron Emission Tomography).

const DICOM_MAP = {
  '0020000D': 'studyInstanceUid',
  '00100020': 'mrn',
  '00080020': 'date',
  '00080030': 'time',
  '00080050': 'accession',
  '00100010': 'patientName',
  '00201208': 'instances',
  '00081030': 'description',
  '00080060': 'modality',
  '00080061': 'modalities'
}

/*
Other IDs
00201209 - Acquisition Number (order within a series)
00200011 - Series Number (number to identify a series)
*/
const { getString, getName, getModalities } = DICOMWeb;

const createCustomDataSource = (): IWebApiDataSource => {
  const implementation = {
    namespace: 'minimal-extension.dataSourcesModule.minimal-extension',
    sourceName: 'minimal x2',
    initialize: (configuration: any): Promise<any> => {
      console.info('MinimalDataSource initialize', configuration);
      return Promise.resolve();
    },

    query: {
      studies: {
        search: (query: any): Promise<any> => {
          console.info('MinimalDataSource STUDY', query);
          const results = processResults(studies);
          console.info('MinimalDataSource STUDY list returning ' + results.length + ' items', results);
          return Promise.resolve(results);
        },
      },
      series: {
        search: (studyInstanceUID: StudyInstanceUID): Promise<any> => {
          console.info('MinimalDataSource SERIES', studyInstanceUID);
          const data = processResults(series);
          console.info('MinimalDataSource data', data);
          const filteredData = data.filter(s => s.studyInstanceUid === studyInstanceUID)
          console.info('MinimalDataSource filteredData', filteredData);
          return Promise.resolve(filteredData);
        },
      },
      instances: {
        search: (seriesInstanceUID: SeriesInstanceUID): Promise<any> => {
          let instances = {};
          console.info('MinimalDataSource INSTANCES', seriesInstanceUID);
          return Promise.resolve(instances.filter(i => i.seriesInstanceUID === seriesInstanceUID));
        },
      },
    },

    retrieve: {
      series: {
        metadata: (
          // params: any
          studyInstanceUID: StudyInstanceUID,
          seriesInstanceUID: SeriesInstanceUID
        ): Promise<any> => {
          const sid = studyInstanceUID['StudyInstanceUID'];
          console.info(
            'MinimalDataSource METADATA retrieve.series.metadata study and series ',sid, seriesInstanceUID);
          if (!sid) {
            throw new Error('Unable to query for SeriesMetadata without StudyInstanceUID');
          }
          const data = metadata; //processResults(metadata);
          console.info('Returning metadata:', data);
          return Promise.resolve(data);
        },
      },
      instance: {
        metadata: (
          instanceInstanceUID: InstanceInstanceUID,
          seriesInstanceUID: SeriesInstanceUID,
          studyInstanceUID: StudyInstanceUID
        ): Promise<any> => {
          console.info(
            'retrieve.instance.metadata',
            instanceInstanceUID,
            seriesInstanceUID,
            studyInstanceUID
          );
          const instanceMetadata = instances.find(
            i => i.instanceInstanceUID === instanceInstanceUID
          );
          return Promise.resolve(instanceMetadata);
        },
        frames: {
          bulkDataURI: (
            options: any,
            seriesInstanceUID: SeriesInstanceUID,
            studyInstanceUID: StudyInstanceUID
          ): Promise<any> => {
            console.info(
              'retrieve.instance.frames.bulkDataURI',
              options,
              seriesInstanceUID,
              studyInstanceUID
            );
            // Return a mock data URI for the image
            return Promise.resolve('data:image/png;base64,mock-image-data');
          },
        },
      },
    },

    store: {
      dicom: (options: any): Promise<any> => {
        console.info('store.dicom', options);
        // Not implemented for this example
        return Promise.reject(new Error('Not implemented'));
      },
    },

    remove: {
      study: (studyInstanceUID: StudyInstanceUID): Promise<any> => {
        console.info('remove.study', studyInstanceUID);
        // Not implemented for this example
        return Promise.reject(new Error('Not implemented'));
      },
    },
    getStudyInstanceUIDs: ({ params, query }) => {
      console.info('MinimalDataSource getStudyInstanceUIDs', params, query);
      return [
        '2.25.317377619501274872606137091638706705333',
      ];
    },
    getImageIdsForDisplaySet(displaySet) {
      const images = displaySet.images;
      const imageIds = [];

      if (!images) {
        return imageIds;
      }

      displaySet.images.forEach(instance => {
        const NumberOfFrames = instance.NumberOfFrames;
        if (NumberOfFrames > 1) {
          // in multiframe we start at frame 1
          for (let i = 1; i <= NumberOfFrames; i++) {
            const imageId = this.getImageIdsForInstance({
              instance,
              frame: i,
            });
            imageIds.push(imageId);
          }
        } else {
          const imageId = this.getImageIdsForInstance({ instance });
          imageIds.push(imageId);
        }
      });

      return imageIds;
    },
  };
  return IWebApiDataSource.create(implementation);
};

function processResults(qidoStudies) {
  if (!qidoStudies || !qidoStudies.length) {
    return [];
  }

  const studies = [];

  // const firstEntry = qidoStudies[0];
  // const field = firstEntry[DICOM_KEY_ModalitiesInStudy];
  // const fValue = getString(getModalities(firstEntry[DICOM_KEY_Modality], firstEntry[DICOM_KEY_ModalitiesInStudy])); //getName(field);
  //console.info('firstEntry: ', firstEntry);
  //console.info('pnameField: ', field);
  //console.info('field value: ', fValue);

  // For modality prop, 'study' wants modalities for main listing, but 'series' wants modality for the key when expanding a study.
  qidoStudies.forEach(qidoStudy => {
    studies.push({
      studyInstanceUid: getString(qidoStudy[DICOM_KEY_StudyInstanceUid]),
      date: getString(qidoStudy[DICOM_KEY_StudyDate]), // YYYYMMDD
      time: getString(qidoStudy[DICOM_KEY_StudyTime]), // HHmmss.SSS (24-hour, minutes, seconds, fractional seconds)
      accession: getString(qidoStudy[DICOM_KEY_AccessionNumber]) || '', // short string, probably a number?
      mrn: getString(qidoStudy[DICOM_KEY_PatientId]) || '', // medicalRecordNumber
      patientName: utils.formatPN(getName(qidoStudy[DICOM_KEY_PatientName])) || '',
      instances: Number(getString(qidoStudy[DICOM_KEY_NumStudyRelatedInstances])) || 0, // number
      description: getString(qidoStudy[DICOM_KEY_StudyDescription]) || '',
      modality: getString(getModalities(qidoStudy[DICOM_KEY_Modality], qidoStudy[DICOM_KEY_ModalitiesInStudy])) || '',
      modalities: getString(getModalities(qidoStudy[DICOM_KEY_Modality], qidoStudy[DICOM_KEY_ModalitiesInStudy])) || '',
    })
  });
  // qidoStudies.forEach(qidoStudy => {
  //   const study = {};

  //   for (const key in qidoStudy) {
  //     if (DICOM_MAP.hasOwnProperty(key)) {
  //       if (key == DICOM_KEY_Modality || key == DICOM_KEY_ModalitiesInStudy) {
  //         study[DICOM_MAP[DICOM_KEY_Modality]] = getString(getModalities(qidoStudy[DICOM_KEY_Modality], qidoStudy[DICOM_KEY_ModalitiesInStudy])) || '';
  //         study[DICOM_MAP[DICOM_KEY_ModalitiesInStudy]] = getString(getModalities(qidoStudy[DICOM_KEY_Modality], qidoStudy[DICOM_KEY_ModalitiesInStudy])) || '';
  //       } else {
  //         study[DICOM_MAP[key]] = qidoStudy[key]; // Remap key
  //       }
  //     } else {
  //       study[key] = qidoStudy[key]; // Keep original key
  //     }
  //   }

  //   studies.push(study);
  // });

  //console.info('returning studies', studies);
  return studies;
}

export default createCustomDataSource;
