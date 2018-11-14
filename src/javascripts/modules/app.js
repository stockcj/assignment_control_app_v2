var _ = require('lodash');

class App {
  constructor (client) {
    this._client = client

    this.initializePromise = this.init()
  }

  getAssigneeOptions() {
    return this._client.get('ticketFields:assignee').then((data) => {
      return data['ticketFields:assignee'];
    })
  };

  getSetting(label) {
    return this._client.metadata().then((metadata) => {
      return metadata.settings[label];
    })
  };

  async settings(label) {
    let setting_values = await this.getSetting(label);
    return _.compact((setting_values || "").split(','));
  };

  contains(collection, values) {
    if (typeof values !== "object")
      return _.includes(collection, values);

    let flattened_contains = _.reduce(values, (result, value) => {
      result.push(_.includes(collection, value));
      return result;
    }, []);
    return _.some(flattened_contains);
  };

  async currentUserIsTarget(user) {
    const rules = [
      ['targeted_user_ids', String(user.id)],
      ['targeted_user_tags', user.tags],
      ['targeted_organization_ids', _.map(user.organizations, (org) => {
        return String(org.id);
      })],
      ['targeted_group_ids', _.map(user.groups, (group) => {
        return String(group.id);
      })]
    ];

    const pArray = rules.map(n => this.funcOne(n));
    const results = await Promise.all(pArray);
    const isTarget = results.some((res) => {
      return res === true;
    });
    return isTarget;
  };

  async funcOne(rule) {
    const setting_values = await this.settings(rule[0]);
    return this.contains(setting_values, rule[1]);
  }

  async hideAssigneeOptions() {
    const group_ids = await this.settings('hidden_group_ids');
    const user_ids = await this.settings('hidden_user_ids');

    const assigneeOptions = await this.getAssigneeOptions();

    assigneeOptions.optionGroups.forEach((option, index) => {
      const group_id = option.value;

      if (this.contains(group_ids, group_id)) {
        this._client.invoke('ticketFields:assignee.optionGroups.' + index + '.hide');
      }
    });

    assigneeOptions.optionValues.forEach((option, index) => {
      const group_and_user = option.value.split(':'),
        user_id = group_and_user[1] || "";

      if (this.contains(user_ids, user_id)) {
        this._client.invoke('ticketFields:assignee.optionValues.' + index + '.hide');
      }
    });
  };

  /**
   * Initialize module, render main template
   */
  async init () {
    const currentUser = (await this._client.get('currentUser')).currentUser;
    
    if(await this.currentUserIsTarget(currentUser)) {
      return this.hideAssigneeOptions();
    }
  }

}

export default App
