/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import styled from 'react-emotion';
import {colors} from './colors';
import {Component} from 'react';
import {shell} from 'electron';
import React from 'react';

const StyledLink = styled('span')({
  color: colors.highlight,
  '&:hover': {
    cursor: 'pointer',
    textDecoration: 'underline',
  },
});
StyledLink.displayName = 'Link:StyledLink';

export default class Link extends Component<{
  href: string;
  children?: React.ReactNode;
}> {
  onClick = () => {
    shell.openExternal(this.props.href);
  };

  render() {
    return (
      <StyledLink onClick={this.onClick}>{this.props.children}</StyledLink>
    );
  }
}
