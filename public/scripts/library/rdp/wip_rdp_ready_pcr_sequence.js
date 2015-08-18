import _ from 'underscore';
import WipRdpReadyAbstractSequence from './wip_rdp_ready_abstract_sequence';
import RdpPcrSequence from './rdp_pcr_sequence';
import RdpTypes from './rdp_types';
import {getPcrProductAndPrimers} from '../../plugins/pcr/lib/pcr_primer_design';


var wip_rdp_ready_pcr_sequence = 'wip_rdp_ready_pcr_sequence';


class WipRdpReadyPcrSequence extends WipRdpReadyAbstractSequence {
  constructor(attrs, options={}) {
    options.NextClass = RdpPcrSequence;
    options.types = RdpTypes.pcrTypes;
    super(attrs, options);
    this.set({_type: wip_rdp_ready_pcr_sequence}, {silent: true});
  }

  getRdpSequenceModel() {
    var error = super.getRdpSequenceModel();
    if(error) return error;

    // getPcrProductAndPrimers uses the stickyEnds attribute in `dataAndOptions`
    // and the tempSequence sequenceBases to calculate the primers and new
    // sequenceBases.
    var options = this.getOptionsForPcr();
    return getPcrProductAndPrimers(this, options)
    .then((pcrProduct) => {
      var attributes = this.toJSON();
      var generalAttributes = _.pick(attributes, 'name', 'shortName', 'desc', 'features');
      var rdpSpecificAttributes = _.pick(attributes, 'partType', 'sourceSequenceName', 'rdpEdits');
      var rdpPcrAttributes = _.extend(
        {displaySettings: {}},
        pcrProduct.toJSON(),
        generalAttributes,
        rdpSpecificAttributes,
        {_type: 'rdp_pcr_product'}
      );
      var rdpPcrSequenceModel = new RdpPcrSequence(rdpPcrAttributes);
      return rdpPcrSequenceModel;
    });
  }

  getOptionsForPcr() {
    var frm = this.get('frm');
    return {
      frm,
      to: frm + this.get('size'),
    };
  }
}

export default WipRdpReadyPcrSequence;
